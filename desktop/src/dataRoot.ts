/**
 * 데이터 루트 = 게임기의 "SD 카드". 설치 폴더(펌웨어)와 분리해 업데이트·재설치에도 남는다.
 *
 *   기본       %APPDATA%/norideck                      (Setup 설치본)
 *   포터블     실행 파일 옆에 norirepo/ 폴더가 있으면 그 폴더  (포터블 exe 를 USB 에 넣어 다니거나 개발 중)
 *
 * 구조 (카트리지 하나 = 폴더 하나):
 *   games/<id>/cart.nori · meta.json · cover.* · saves/<slot>.json
 *
 * 예전 구조(library/<id>/, saves/<id>/)는 첫 실행 때 games/<id>/ 로 옮긴다.
 */
import { app } from 'electron';
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';

/** 포터블 모드 폴더 이름 (실행 파일 옆) */
export const PORTABLE_DIR = 'norirepo';
/** 카트리지 폴더들의 루트 (데이터 루트 아래) */
export const GAMES_DIR = 'games';

/** 실행 파일이 있는 폴더. electron-builder 포터블은 임시 폴더에서 돌아가므로 원래 위치를 환경 변수로 준다 */
function executableDir(): string {
  return process.env.PORTABLE_EXECUTABLE_DIR ?? path.dirname(process.execPath);
}

/** 데이터 루트를 정해 app 의 userData 로 등록한다. app.whenReady() 전에 부른다 */
export function configureDataRoot(consoleId: string): { root: string; portable: boolean } {
  const portable = path.join(executableDir(), PORTABLE_DIR);
  if (existsSync(portable)) {
    app.setPath('userData', portable);
    // 브라우저 캐시 같은 잡동사니는 .cache/ 로 몰아 norirepo/ 에 games/ 만 눈에 띄게
    app.setPath('sessionData', path.join(portable, '.cache'));
    return { root: portable, portable: true };
  }
  const root = path.join(app.getPath('appData'), consoleId);
  app.setPath('userData', root);
  return { root, portable: false };
}

export function gamesRoot(): string {
  return path.join(app.getPath('userData'), GAMES_DIR);
}

async function moveDir(from: string, to: string): Promise<void> {
  await fs.mkdir(to, { recursive: true });
  for (const name of await fs.readdir(from)) {
    const target = path.join(to, name);
    if (existsSync(target)) continue; // 이미 새 구조에 있으면 예전 것은 두지 않는다
    await fs.rename(path.join(from, name), target);
  }
  await fs.rm(from, { recursive: true, force: true });
}

/**
 * 예전 구조 → games/<id>/ 이전. 실패해도 콘솔은 뜬다 (경고만).
 *   library/<id>/*        → games/<id>/*
 *   saves/<id>/<slot>.json → games/<id>/saves/<slot>.json
 */
export async function migrateLegacyLayout(): Promise<void> {
  const root = app.getPath('userData');
  const games = gamesRoot();
  try {
    const library = path.join(root, 'library');
    if (existsSync(library)) {
      for (const entry of await fs.readdir(library, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        await moveDir(path.join(library, entry.name), path.join(games, entry.name));
      }
      await fs.rm(library, { recursive: true, force: true });
    }
    const saves = path.join(root, 'saves');
    if (existsSync(saves)) {
      for (const entry of await fs.readdir(saves, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        await moveDir(path.join(saves, entry.name), path.join(games, entry.name, 'saves'));
      }
      await fs.rm(saves, { recursive: true, force: true });
    }
  } catch (error) {
    console.warn('[norideck] 예전 데이터 폴더를 옮기지 못했습니다', error);
  }
}
