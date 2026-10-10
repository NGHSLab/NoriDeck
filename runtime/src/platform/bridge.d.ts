/**
 * 데스크톱(Electron) 껍데기가 preload 에서 window.norideck 으로 노출하는 계약.
 *
 * 콘솔 런타임만 이 타입을 안다. 카트리지는 SDK(ConsoleAPI) 를 통해서만 OS 기능을 쓴다.
 * 구현은 desktop/src/preload.ts. 브라우저에서 실행될 때는 window.norideck 이 없다.
 */
export interface DesktopSaveStore {
  /** 카트리지·슬롯별 세이브. 없으면 null */
  read(cartId: string, slot: string): Promise<string | null>;
  write(cartId: string, slot: string, raw: string): Promise<void>;
  remove(cartId: string, slot: string): Promise<void>;
  list(cartId: string): Promise<string[]>;
  /** 카트리지의 세이브 폴더를 통째로 지운다 */
  clear(cartId: string): Promise<void>;
}

export interface DesktopWindowState {
  maximized: boolean;
  fullscreen: boolean;
}

export interface DesktopWindowControls {
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
  setFullscreen(on: boolean): Promise<void>;
  /** 게임 영역(타이틀바 제외) 크기를 CSS px 로 지정. 최대화 상태면 먼저 해제한다 */
  setContentSize(width: number, height: number): Promise<void>;
  getState(): Promise<DesktopWindowState>;
  onStateChange(listener: (state: DesktopWindowState) => void): () => void;
}

/** 콘솔이 여는 OS 폴더. 경로는 데스크톱이 정한다: games = 카트리지 폴더들(games/<id>/), userData = 데이터 루트 */
export type DesktopFolder = 'games' | 'userData';

export interface DesktopSystem {
  /** 폴더를 OS 탐색기로 열고 실제 경로를 돌려준다 */
  openFolder(folder: DesktopFolder): Promise<string>;
  toggleDevTools(): Promise<void>;
  /** "다른 이름으로 저장" 대화상자를 띄워 bytes 를 쓴다. 취소하면 null, 아니면 저장한 경로 */
  saveFile(options: {
    defaultName: string;
    /** 확장자 (점 없이) */
    extensions: string[];
    bytes: Uint8Array;
  }): Promise<string | null>;
}

/**
 * 라이브러리에 저장되는 카트리지 정보. .nori 의 manifest.json 에서 런타임이 골라 보낸다.
 * (SDK 타입을 데스크톱이 직접 import 하지 않도록 필요한 필드만 따로 정의한다)
 */
export interface DesktopLibraryManifest {
  id: string;
  title: string;
  version: string;
  sdkVersion: string;
  screen: { width: number; height: number; layout: string };
  author?: string;
  description?: string;
  homepage?: string;
  /** 패키지 안 커버 파일명 (cover.png 등) */
  cover?: string;
}

/** 라이브러리 목록 한 항목 */
export interface DesktopLibraryEntry extends DesktopLibraryManifest {
  /** 커버 이미지 data: URL. 커버가 없으면 생략 */
  coverUrl?: string;
  /** ISO 8601 */
  importedAt: string;
  lastPlayedAt?: string;
  /** .nori 파일 크기 (bytes) */
  fileSize: number;
}

export interface DesktopLibraryImport {
  manifest: DesktopLibraryManifest;
  /** 검사를 통과한 .nori 파일 전체 */
  bytes: Uint8Array;
  /** 패키지에서 꺼낸 커버 이미지 */
  cover?: { name: string; bytes: Uint8Array };
}

/**
 * 가져온 카트리지 보관소 (<데이터 루트>/games/<id>/). 홈 화면이 카드로 보여 준다.
 * 검사(zip 구조·매니페스트·체크섬)는 런타임이 하고, 데스크톱은 파일을 보관만 한다.
 */
export interface DesktopLibrary {
  /** 가져온 순 (오래된 것부터) */
  list(): Promise<DesktopLibraryEntry[]>;
  /** 같은 id 가 있으면 새 파일로 바꾼다 (세이브는 그대로) */
  import(input: DesktopLibraryImport): Promise<DesktopLibraryEntry>;
  /** 저장된 .nori 바이트. 마지막 실행 시각을 갱신한다 */
  read(id: string): Promise<Uint8Array>;
  remove(id: string): Promise<void>;
  /** 해당 카트리지 폴더를 OS 탐색기로 연다 */
  openFolder(id: string): Promise<string>;
  /** cart.nori 를 <id>-<version>.nori 이름으로 다른 곳에 저장 (대화상자). 취소하면 null */
  export(id: string): Promise<string | null>;
}

export interface DesktopBridge {
  isDesktop: true;
  platform: string;
  version(): Promise<string>;
  /** 데이터 루트("SD 카드") 경로. 실행 파일 옆 norirepo/ 가 있으면 포터블 */
  dataRoot(): Promise<{ path: string; portable: boolean }>;
  save: DesktopSaveStore;
  window: DesktopWindowControls;
  system: DesktopSystem;
  library: DesktopLibrary;
}

declare global {
  interface Window {
    norideck?: DesktopBridge;
  }
}
