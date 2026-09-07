# 방문자 통계 연결

현재 구성: Google Analytics 4, 측정 ID `G-57J23C7J94`. Cloudflare는 비활성입니다.

GA4의 보고서 → 실시간에서 현재 방문을 확인하고, 획득 보고서에서 유입 경로를 확인합니다. 과거 미수집 방문 기록은 복원되지 않습니다. 배포 후 수집 여부는 실제 브라우저와 관리자 보고서에서 각각 확인해야 합니다.

`data/analytics.json`의 `googleAnalyticsId`를 빈 문자열로 바꾸고 재빌드·배포하면 GA4를 끌 수 있습니다. Google Signals와 광고 개인화 신호는 코드에서 비활성화했습니다. 페이지에는 Google Analytics와 쿠키 사용 안내를 표시합니다.

아래 내용은 대안인 Cloudflare 설정 방법이며 현재 적용된 통계 구성은 아닙니다.

## 최초 설정

1. 연구실 관리자가 소유한 Cloudflare 계정에서 Web Analytics → Add a site를 선택합니다.
2. hostname을 `emdplab.github.io`로 등록합니다. GitHub Pages와 DNS는 그대로 유지합니다.
3. Manage site의 JavaScript snippet에서 `data-cf-beacon` 안에 있는 `token` 값만 복사합니다.
4. `data/analytics.json`의 `cloudflareToken`에 붙여 넣습니다. 계정 API 키나 비밀번호를 넣지 않습니다. 이 값은 공개 페이지에 포함되는 사이트 식별자입니다.
5. `npm run build`와 `npm test` 후 변경 파일을 GitHub Pages에 배포합니다.
6. 공개 홈페이지를 방문한 뒤 Cloudflare Web Analytics 대시보드에서 실제 데이터가 들어오는지 확인합니다. 차단 확장 기능이 있는 브라우저는 누락될 수 있습니다.

빈 문자열로 되돌리고 재빌드·배포하면 분석 스크립트와 해당 외부 도메인 허용이 제거됩니다. 지원서 입력값이나 파일을 수집하는 별도 이벤트 코드는 추가하지 않았습니다.

## 관리자가 볼 지표

- Referer: 어느 외부 사이트에서 유입되는지
- Country / Device type: 국가와 모바일·데스크톱 비중
- Path / Page views: 홈, 연구, 논문, 뉴스, Study, 지원 페이지별 조회
- Visits: 방문 추세. 페이지 조회 수와 서로 다른 지표입니다.

유입 정보가 없는 방문은 검색·SNS 등으로 단정하지 마세요. 일부 앱과 브라우저는 referrer를 전달하지 않습니다. 이 구성은 개인별 동선이나 체류 시간, 지원 전환을 측정하지 않습니다. 페이지 로딩 시간은 체류 시간이 아닙니다.

## 개선 효과 확인

2~4주 데이터를 모은 뒤 같은 길이의 기간을 비교합니다. 연구와 논문 조회 증가, 뉴스 방문 후 다른 페이지 조회 증가, 지원 페이지 관심, 모바일 읽기 성능을 확인합니다. 이 통계만으로 동일인의 페이지 이동이나 실제 지원 완료를 판정하지 않습니다. 작은 방문 수에서는 비율 변화보다 실제 조회 수를 함께 봅니다.

관리 대시보드는 Cloudflare 로그인 뒤에 유지합니다. 공개 웹사이트에 관리 API 키나 원시 방문 로그를 넣지 않습니다.

공식 문서:
- https://developers.cloudflare.com/web-analytics/get-started/
- https://developers.cloudflare.com/web-analytics/data-metrics/dimensions/
- https://developers.cloudflare.com/web-analytics/about/
