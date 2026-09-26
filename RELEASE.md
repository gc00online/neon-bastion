# 출시 체크리스트

## 0. 이미 준비된 것
- [x] 게임 본체 (한국어/영어)
- [x] iOS / Android 프로젝트 (`ios/`, `android/`) — 세로 고정, 상태바 숨김, iPhone 전용
- [x] 앱 아이콘, 스플래시 (모든 크기 생성 완료)
- [x] 스토어 스크린샷: `store/ios`, `store/ios-en` (1320×2868), `store/google`, `store/google-en` (1080×1920)
- [x] Google Play 그래픽 이미지 `store/google-feature-graphic-1024x500.png`, 아이콘 `store/google-icon-512.png`
- [x] 스토어 설명문·키워드·심사 설문 답변: `store/listing.md`
- [x] 개인정보처리방침 초안: `docs/privacy.html`
- [x] Android Studio 설치됨 (`/Applications/Android Studio.app`)

## 1. 개발 도구 준비 (직접 해야 함)
### Xcode (iOS)
설치된 Xcode 14.3.1은 너무 오래돼서 현재 macOS에서 실행되지 않고, 앱스토어 제출에도 최신 버전이 필요합니다.
1. Mac App Store에서 **Xcode** 검색 → 업데이트/설치 (Apple ID 로그인 필요, 용량 큼)
2. 설치 후 터미널에서 (관리자 비밀번호 입력 필요):
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -license accept
   ```
3. Xcode를 한 번 실행해서 iOS 플랫폼(시뮬레이터) 추가 설치

### Android Studio
1. `/Applications/Android Studio.app` 실행
2. 첫 실행 마법사에서 **Standard** 선택 → 라이선스 동의 → SDK 다운로드 (10분 정도)
3. 끝나면 `npm run android` 로 프로젝트 열기 → ▶ 로 에뮬레이터/폰에서 실행

## 2. 계정
- [ ] Apple Developer Program 가입 ($99/년) — developer.apple.com/programs
- [ ] Google Play Console 가입 ($25 1회) — play.google.com/console
- [ ] Google Play 비공개 테스트용 **테스터 12명** 모으기 (14일 연속 참여 필요)

## 3. 출시 전 수정할 것
- [ ] `capacitor.config.ts`의 `appId` → 본인 고유 ID (예: `com.yourname.neonbastion`). **한 번 올리면 못 바꿈**
      바꾼 뒤: `ios/`, `android/` 폴더 삭제 → `npx cap add ios && npx cap add android` → 아이콘 재생성 명령 실행 → 세로 고정 설정 다시 적용
      (이 작업은 요청하시면 제가 해드릴게요)
- [ ] `docs/privacy.html`의 [개발자 이름], [연락처 이메일] 채우기 → GitHub Pages 등에 올려 URL 확보

## 4. iOS 출시
1. `npm run ios` → Xcode에서 App 타깃 › Signing & Capabilities › Team 선택
2. 실제 아이폰 연결해서 ▶ 실행 → 플레이 테스트
3. App Store Connect에서 새 앱 생성 (번들 ID = appId)
4. Xcode › Product › Archive → Distribute App → App Store Connect 업로드
5. TestFlight로 테스트 → 스토어 정보 입력(`store/listing.md`) → 스크린샷 업로드(`store/ios`) → 심사 제출

## 5. Android 출시
1. `npm run android` → Build › Generate Signed App Bundle → 새 키스토어 생성 (**키 파일과 비밀번호는 절대 잃어버리면 안 됨**, 안전한 곳에 백업)
2. Play Console에서 앱 생성 → 비공개 테스트 트랙에 .aab 업로드 → 테스터 12명 초대 → 14일 운영
3. 스토어 정보(`store/listing.md`), 그래픽(`store/google*`), 콘텐츠 등급·데이터 보안 설문 작성
4. 프로덕션 액세스 신청 → 출시

## 6. 버전 올릴 때
- iOS: Xcode에서 Version(1.0 → 1.1), Build(1 → 2)
- Android: `android/app/build.gradle`의 `versionCode`(+1), `versionName`
