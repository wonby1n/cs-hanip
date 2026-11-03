---
no: 1
title: 티켓팅 10시 정각, 서버는 왜 터질까?
category: [동시성, 네트워크, 시스템설계]
date: 2026-11-03
summary: 짧은 순간에 요청이 몰리면 서버가 동시에 처리할 자원이 바닥나고, 줄 선 요청들이 시간 초과로 무더기 실패하기 때문이에요.
recall:
  prompt: 친구가 "티켓팅 때 서버 왜 터져? 그럼 어떻게 막아?"라고 물어요. 3~4문장으로 설명해보세요.
  keyPoints:
    - 요청이 짧은 시간에 몰린다
    - 스레드·DB 커넥션 같은 자원이 한정돼 있다
    - 대기하다 시간 초과로 실패한다 (새로고침이 부하를 키움)
    - "해결 ① 들어오는 양 조절: 대기열, 처리량 제한"
    - "해결 ② 처리량 늘리기: 미리 서버 증설, 캐시"
followups:
  - q: 같은 좌석을 두 사람이 거의 동시에 결제하면 어떻게 한 명만 성공하게 만들 수 있을까요?
    answer: 좌석 확인과 차감을 하나로 묶어서 동시에 끼어들지 못하게 해야 해요. DB 행에 락을 걸고 한 트랜잭션으로 처리하거나, 좌석에 유니크 제약을 걸어 두 번째 예약을 DB가 거부하게 하거나, Redis에 선점 표시를 원자적으로 걸고 일정 시간 안에 결제하지 않으면 풀어주는 방법이 있어요.
  - q: 오토스케일링을 켜두면 티켓팅 폭주도 해결되지 않나요?
    answer: 오토스케일링은 부하를 감지한 뒤에 서버를 띄우기 때문에 보통 몇 분이 걸려요. 티켓팅은 정각에 몇 초 만에 몰리니까 그 사이에 이미 터져요. 그래서 오픈 시각을 아는 경우엔 미리 증설해두고, 대기열로 유입량을 조절해요.
sim: traffic
seenIn: []
sources:
  - title: MDN - 429 Too Many Requests
    url: https://developer.mozilla.org/ko/docs/Web/HTTP/Status/429
  - title: AWS Builders' Library - Timeouts, retries, and backoff with jitter
    url: https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
  - title: HikariCP - About Pool Sizing
    url: https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing
authors: [wonby1n]
reviewers: []
---

## 식당으로 생각해보면

테이블([[스레드]])은 200개인데 주방에 요리사([[DB 커넥션]])는 10명뿐이에요. 10시에 손님 5만 명이 동시에 문을 열고 들어오면? 테이블은 금방 차고, 앉은 손님도 요리사를 기다리느라 못 일어나고, 문 밖 줄은 끝없이 길어져요.

## 무슨 일이 일어나나요

**스레드 풀·커넥션 풀 고갈.** [[서버]]는 [[요청]]마다 스레드를, [[DB]]를 쓸 땐 커넥션을 빌려 써요. 둘 다 [[스레드 풀]], [[커넥션 풀]]처럼 개수가 정해져 있어서 다 빌려가면 다음 요청은 반납될 때까지 기다려야 해요.

**대기가 길어지면 연쇄 실패.** 기다리다 정해진 시간을 넘기면 [[타임아웃]]으로 실패해요. 사용자는 새로고침을 누르고, 그게 또 요청이 돼서 부하가 더 커지는 악순환이 생겨요.

**같은 좌석, 두 명이 결제?** "남은 좌석 확인 → 결제" 사이에 다른 요청이 끼어들면 둘 다 빈 좌석으로 보고 결제할 수 있어요. 이게 [[경쟁 상태]]예요.

## 그럼 어떻게 막아요?

핵심은 두 가지예요. **들어오는 양을 조절**하거나, **[[처리량]]을 늘리거나.** 실제로는 여러 개를 같이 써요.

| 분류 | 방법 | 한 줄 설명 |
|---|---|---|
| 조절 | 대기열 (가상 대기실) | 감당할 만큼만 입장시키고 나머지는 순번을 줘서 기다리게 해요. |
| 조절 | [[처리량 제한]] | 사용자·IP당 초당 요청 수를 넘으면 바로 거절해요. |
| 조절 | 클라이언트 협조 | 버튼 연타를 막고, 재시도는 [[지수 백오프]]로 간격을 늘려요. |
| 늘리기 | 미리 [[스케일 아웃]] | 오픈 시각을 아니까 미리 서버를 늘려둬요. [[오토스케일링]]은 늦어요. |
| 늘리기 | 읽기는 캐시로 | 공연 정보·좌석 배치도는 [[캐시]]·[[CDN]]에서 돌려주고 결제만 DB로 보내요. |
| 정확성 | 좌석 선점은 한 번에 | [[락]], [[유니크 제약]], [[원자적]] 선점 + 만료 시간으로 중복 결제를 막아요. |

## 자료구조·알고리즘으로 보면

방법 이름만 외우면 꼬리질문에서 막혀요. "그래서 어떻게 구현하는데요?"까지 가볼게요. 아래 코드는 원리를 보여주려고 줄인 의사 코드예요.

### 1. 대기열 = 큐

대기열의 정체는 [[큐]]예요. 먼저 온 사람이 먼저 들어가는 [[FIFO]] 규칙 그대로예요. 실무에선 [[Redis]]의 [[정렬된 집합]]을 많이 써요. 들어온 시각을 점수로 넣으면 자동으로 순서대로 정렬되고, 내 순번도 바로 알 수 있어서요.

```ts
// 1) 줄 서기: 들어온 시각을 점수로 넣는다
//    Redis: ZADD waiting <현재시각> <userId>
function enter(userId: string) {
  waiting.add(userId, Date.now());
}

// 2) 내 순번 확인: 앞에 몇 명 있는지
//    Redis: ZRANK waiting <userId>   (0부터 시작)
function myTurn(userId: string): number {
  return waiting.rank(userId) + 1;
}

// 3) 1초마다 서버가 감당할 만큼만 꺼내서 입장시킨다
//    Redis: ZPOPMIN waiting <개수>
setInterval(() => {
  const admitted = waiting.popMin(500); // 초당 500명만
  admitted.forEach(grantEntryToken);    // 입장권을 받은 사람만 예매 서버로
}, 1000);
```

포인트는 **예매 서버에 들어가는 양이 초당 500명으로 고정**된다는 거예요. 5만 명이 몰려도 서버는 500명분만 일해요. 줄에 서 있는 5만 명은 "순번 확인"만 하니까 훨씬 가벼워요.

### 2. 처리량 제한 = 토큰 버킷

매크로나 새로고침 연타는 [[토큰 버킷]]으로 걸러요. 통에 토큰이 일정 속도로 채워지고, 요청 하나가 토큰 하나를 써요. 통이 비면 거절해요.

```ts
// 사용자마다 통 하나. 최대 5개, 1초에 1개씩 채워짐
function allow(bucket: { tokens: number; last: number }): boolean {
  const now = Date.now() / 1000;
  bucket.tokens = Math.min(5, bucket.tokens + (now - bucket.last) * 1); // 지난 시간만큼 채움
  bucket.last = now;
  if (bucket.tokens < 1) return false; // 토큰 없음 → 429로 거절
  bucket.tokens -= 1;
  return true;
}
```

통 크기(5)만큼은 몰아서 보낼 수 있어서 정상 사용자가 몇 번 빠르게 누르는 건 괜찮고, 계속 연타하면 초당 1번으로 묶여요. 거절할 땐 [[HTTP 상태 코드]] 429를 돌려줘요.

### 3. 재시도 = 지수 백오프 + 지터

실패했다고 모두가 바로 다시 누르면 또 몰려요. 그래서 기다리는 시간을 두 배씩 늘리고, 거기에 [[지터]](무작위 값)를 섞어요.

```ts
async function retry<T>(job: () => Promise<T>, maxTry = 5): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await job();
    } catch (e) {
      if (attempt + 1 >= maxTry) throw e;
      const cap = Math.min(30_000, 1000 * 2 ** attempt); // 1초, 2초, 4초, 8초… 최대 30초
      await sleep(Math.random() * cap);                 // 0 ~ cap 사이 무작위로 기다림
    }
  }
}
```

지터가 없으면 같은 순간에 실패한 사람들이 정확히 2초 뒤에 또 같이 몰려요. 무작위로 흩어줘야 부하가 퍼져요.

### 4. 좌석 선점 = "확인하고 바꾸기"를 한 번에

경쟁 상태의 원인은 **확인**과 **변경**이 따로 일어나는 거예요. 둘을 [[원자적]]으로 묶으면 끝나요.

```sql
-- 확인과 변경을 한 문장으로. 이미 누가 잡았으면 바뀐 행이 0개 → 실패 처리
UPDATE seats
SET status = 'HELD', user_id = :userId
WHERE seat_id = :seatId AND status = 'AVAILABLE';
```

```ts
// Redis로 선점: 키가 없을 때만 저장(NX) + 5분 뒤 자동 삭제(EX 300)
// Redis: SET seat:A-12 <userId> NX EX 300
const ok = await redis.set(`seat:${seatId}`, userId, { NX: true, EX: 300 });
if (!ok) throw new Error("이미 다른 사람이 선택한 좌석이에요");
```

SQL 쪽은 조건부 업데이트라는 [[낙관적 락]] 계열 방식이고, Redis 쪽은 [[TTL]]을 걸어서 결제 안 하고 나가면 5분 뒤 좌석이 자동으로 풀려요.
