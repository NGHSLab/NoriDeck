# @nghslab/nori-cli — `nori`

NoriDeck 카트리지(`.nori`)를 만들고 묶고 검사하는 명령줄 도구입니다.

```bash
npm create nori@latest my-cart      # 또는: npx @nghslab/nori-cli init my-cart
cd my-cart && npm install
npm run pack                         # nori build .  → dist/my-cart-0.1.0.nori
npm run check                        # nori check dist/my-cart-0.1.0.nori
```

만든 `.nori` 를 NoriDeck 홈 화면에 끌어다 놓으면 라이브러리에 들어갑니다.

| 명령                                             | 하는 일                                                 |
| ------------------------------------------------ | ------------------------------------------------------- |
| `nori init [폴더] [--id] [--title] [--force]`    | 새 카트리지 프로젝트 뼈대                               |
| `nori build [폴더] [--out <폴더>] [--sourcemap]` | nori.json 이 있는 프로젝트 → `dist/<id>-<version>.nori` |
| `nori check <파일.nori>`                         | 매니페스트 · 체크섬 · SDK 버전 검사                     |
| `nori unpack <파일.nori> [폴더] [--force]`       | 폴더로 풀기 (디버깅, 콘솔 개발 서버에서 실행)           |
| `nori --help`                                    | nori.json 규칙 요약 포함                                |

개발 가이드: https://github.com/NGHSLab/NoriDeck/blob/main/docs/cartridge-guide.md
