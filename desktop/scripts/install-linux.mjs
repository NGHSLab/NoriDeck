/**
 * 빌드한 Linux 앱을 사용자 홈에 설치한다 (sudo 없이, 이 사용자만).
 *
 *   앱 본체   ~/.local/opt/norideck/            (release/<버전>/linux-unpacked 통째로)
 *   실행 링크 ~/.local/bin/norideck             (PATH 에 있으면 터미널에서 바로)
 *   아이콘    ~/.local/share/icons/hicolor/<크기>/apps/norideck.png
 *   메뉴 항목 ~/.local/share/applications/norideck.desktop
 *
 * 작업 표시줄이 창과 메뉴 항목을 같은 앱으로 묶으려면 .desktop 의 StartupWMClass 가
 * 창의 WM_CLASS(= electron-builder 의 executableName)와 같아야 한다.
 *
 * 실행: npm run install:linux -w desktop  (먼저 npm run build:desktop)
 */
import { existsSync, readFileSync, promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** electron-builder 의 linux.executableName 과 같아야 한다 (WM_CLASS · 파일 이름) */
const APP_ID = 'norideck';
const APP_NAME = 'NoriDeck';
/** electron-builder 출력은 release/<package.json version>/ */
const { version } = JSON.parse(readFileSync(path.join(desktopDir, 'package.json'), 'utf8'));
const SOURCE = path.join(desktopDir, 'release', version, 'linux-unpacked');

const home = homedir();
const installDir = path.join(home, '.local', 'opt', APP_ID);
const binLink = path.join(home, '.local', 'bin', APP_ID);
const iconsRoot = path.join(home, '.local', 'share', 'icons', 'hicolor');
const appsDir = path.join(home, '.local', 'share', 'applications');
const desktopFile = path.join(appsDir, `${APP_ID}.desktop`);

/** 크기별 아이콘 (원본 → hicolor 규격 폴더). 크기가 맞는 파일만 넣는다 */
const ICONS = [
  { file: 'icon.png', size: '512x512' },
  { file: 'icon-256.png', size: '256x256' },
];

const DESKTOP_ENTRY = `[Desktop Entry]
Type=Application
Name=${APP_NAME}
Comment=TypeScript 카트리지(.nori)를 실행하는 레트로 게임기 콘솔
Exec=${path.join(installDir, APP_ID)} %f
Icon=${APP_ID}
Terminal=false
Categories=Game;
StartupWMClass=${APP_ID}
`;

/** 있으면 부르고 없으면 넘어가는 선택적 명령 (아이콘·메뉴 캐시 갱신) */
function refresh(command, args) {
  const result = spawnSync(command, args, { stdio: 'ignore' });
  return result.error === undefined && result.status === 0;
}

async function main() {
  if (!existsSync(SOURCE)) {
    console.error(
      `빌드 결과가 없습니다: ${SOURCE}\n먼저 저장소 루트에서 npm run build:desktop 을 실행하세요.`,
    );
    process.exitCode = 1;
    return;
  }

  // 앱 본체: 통째로 교체 (예전 버전 파일이 남지 않도록)
  await fs.rm(installDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(installDir), { recursive: true });
  await fs.cp(SOURCE, installDir, { recursive: true });

  // 실행 링크
  await fs.mkdir(path.dirname(binLink), { recursive: true });
  await fs.rm(binLink, { force: true });
  await fs.symlink(path.join(installDir, APP_ID), binLink);

  // 아이콘
  for (const { file, size } of ICONS) {
    const from = path.join(desktopDir, 'build', file);
    if (!existsSync(from)) continue;
    const to = path.join(iconsRoot, size, 'apps', `${APP_ID}.png`);
    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.copyFile(from, to);
  }

  // 메뉴 항목
  await fs.mkdir(appsDir, { recursive: true });
  await fs.writeFile(desktopFile, DESKTOP_ENTRY, 'utf8');
  await fs.chmod(desktopFile, 0o755);

  refresh('gtk-update-icon-cache', ['-f', '-t', iconsRoot]);
  refresh('update-desktop-database', [appsDir]);

  console.log(`설치했습니다:
  앱      ${installDir}
  실행    ${binLink}
  메뉴    ${desktopFile}`);
}

await main();
