/**
 * 콘솔 UI 문자열 (한국어 · 영어). 게임 안 문자열은 각 카트리지의 몫이라 여기 없다.
 *
 *   t('file.home')                          → 현재 언어 문자열
 *   t('status.imported', { title, version }) → {title} 자리 치환
 *
 * 선택한 언어는 localStorage 에 남고, 바꾸면 onLangChange 구독자(타이틀바·홈)가 다시 그린다.
 * 첫 실행 기본값은 브라우저 언어가 한국어면 ko, 아니면 en.
 */
export type Lang = 'ko' | 'en';

/** 언어 목록 (영어 먼저). 표시 이름은 현재 UI 언어로: t('lang.en') · t('lang.ko') */
export const LANGS: readonly Lang[] = ['en', 'ko'];

const STORAGE_KEY = 'norideck.lang';

const ko = {
  'menu.settings': 'Config',
  'menu.file': '파일',
  'menu.tools': '도구',
  'menu.view': '보기',
  'menu.help': '도움말',
  'file.home': '홈',
  'file.add': '카트리지 추가',
  'file.quit': '종료',
  'tools.speed': '배속 ×{speed}',
  'tools.gamesFolder': '게임 폴더 열기',
  'tools.dataFolder': '데이터 폴더 열기',
  'tools.language': '언어',
  'config.volume': '소리 크기',
  'config.mute': '음소거',
  'config.fastSpeed': '배속',
  'volume.title': '소리 크기',
  'volume.note': '게임 소리의 마스터 볼륨입니다. 움직이는 대로 바로 적용됩니다.',
  'tools.devtools': '개발자 도구',
  'view.zoom': '창 배율',
  'view.fullscreen': '전체화면',
  'help.keymap': '키 배치',
  'help.about': '정보',
  'tb.minimize': '최소화',
  'tb.maximize': '최대화',
  'tb.restore': '이전 크기로 복원',
  'tb.close': '닫기',
  'dialog.close': '닫기',
  'dialog.cancel': '취소',
  'keymap.title': '키 배치',
  'keymap.dpad': '십자키',
  'keymap.speed': '배속 토글',
  'keymap.fullscreen': '전체화면',
  'keymap.note':
    '칸의 키를 누른 뒤 원하는 키를 누르세요. 한 키는 한 곳에만 붙고, 이전에 그 키를 쓰던 버튼에서는 빠집니다.',
  'keymap.pressFor': '{button} 에 붙일 키를 누르세요 (Esc 취소)',
  'keymap.console': '콘솔',
  'keymap.reset': '기본값으로',
  'keymap.home': '홈',
  'keymap.reserved': '콘솔 예약',
  'keymap.reservedKey': '{key} 은(는) 콘솔 예약 키라 쓸 수 없습니다',
  'about.title': '{name} 정보',
  'about.format': '.nori 포맷',
  'about.platform': '플랫폼',
  'about.cartridge': '카트리지',
  'about.screen': '화면',
  'about.cartSdk': '카트리지 SDK',
  'about.dataRoot': '데이터 폴더',
  'about.portable': '포터블',
  'info.title': '제목',
  'info.version': '버전',
  'info.author': '제작자',
  'info.size': '크기',
  'info.imported': '가져온 날짜',
  'info.lastPlayed': '마지막 실행',
  'lang.title': '언어',
  'lang.en': '영어(미국)',
  'lang.ko': '한국어',
  'lang.note': '콘솔 화면의 언어입니다. 게임 안 언어는 각 카트리지가 정합니다.',
  'home.drop': '{ext} 파일을 여기에 놓기',
  'car.prev': '이전 카트리지 (←)',
  'car.next': '다음 카트리지 (→)',
  'car.run': '{title} 실행 (Enter)',
  'car.resume': '{title} 이어서 하기 (Enter)',
  'car.paused': '일시정지 중 · 클릭하면 이어서',
  'car.menu': '카트리지 메뉴',
  'car.start': '시작',
  'car.resumeBtn': '이어서',
  'car.options': '옵션',
  'car.info': '정보',
  'car.folder': '폴더 열기',
  'car.close': '게임 종료',
  'car.remove': '삭제',
  'car.export': '카트리지 내보내기',
  'car.backup': '세이브 백업',
  'car.restore': '세이브 복원',
  'car.clearSaves': '세이브 지우기',
  'status.exported': '{path} 에 내보냈습니다',
  'status.backedUp': '세이브를 {path} 에 저장했습니다',
  'status.noSaves': '{title} 에는 세이브가 없습니다',
  'status.restored': '세이브 {count}개를 복원했습니다',
  'status.savesCleared': '{title} 의 세이브를 지웠습니다',
  'err.restore': '백업 파일 안에 세이브가 없습니다 (*.json)',
  'clearSaves.title': '세이브 지우기',
  'clearSaves.message': '{title} 의 세이브를 모두 지웁니다. 되돌릴 수 없습니다.',
  'clearSaves.confirm': '지우기',
  'restore.title': '세이브 복원',
  'restore.message': '{title} 의 세이브를 백업 파일로 덮어씁니다.\n슬롯: {slots}',
  'restore.confirm': '복원',
  'boot.booting': '{name} 부팅 중…',
  'boot.loading': '카트리지 로드 중… ({id})',
  'boot.cannotRun': '카트리지를 실행할 수 없습니다: {error}',
  'boot.sdkMismatch': 'SDK 버전이 맞지 않습니다: 카트리지 {cart}, 콘솔 {console}',
  'status.opening': '{name} 여는 중…',
  'status.importing': '{name} 가져오는 중…',
  'status.imported': '{title} v{version} 을(를) 가져왔습니다',
  'status.loading': '{title} 불러오는 중…',
  'status.removed': '{title} 을(를) 지웠습니다',
  'status.closed': '{title} 을(를) 종료했습니다',
  'err.folder': '폴더를 열 수 없습니다',
  'err.library': '라이브러리를 읽을 수 없습니다',
  'remove.title': '카트리지 삭제',
  'remove.message':
    '{title} v{version} 을(를) 라이브러리에서 지웁니다.\n세이브는 남습니다 (도구 → 게임 폴더 열기).',
  'remove.confirm': '삭제',
  'close.title': '게임 종료',
  'close.message': '{title} 을(를) 종료합니다. 저장하지 않은 진행은 사라집니다.',
  'close.confirm': '종료',
} as const;

export type MessageKey = keyof typeof ko;

const en: Record<MessageKey, string> = {
  'menu.settings': 'Config',
  'menu.file': 'File',
  'menu.tools': 'Tools',
  'menu.view': 'View',
  'menu.help': 'Help',
  'file.home': 'Home',
  'file.add': 'Add cartridge',
  'file.quit': 'Quit',
  'tools.speed': 'Speed ×{speed}',
  'tools.gamesFolder': 'Open games folder',
  'tools.dataFolder': 'Open data folder',
  'tools.language': 'Language',
  'config.volume': 'Volume',
  'config.mute': 'Mute',
  'config.fastSpeed': 'Fast-forward speed',
  'volume.title': 'Volume',
  'volume.note': 'Master volume for game audio. Applies as you drag.',
  'tools.devtools': 'Developer tools',
  'view.zoom': 'Window scale',
  'view.fullscreen': 'Fullscreen',
  'help.keymap': 'Controls',
  'help.about': 'About',
  'tb.minimize': 'Minimize',
  'tb.maximize': 'Maximize',
  'tb.restore': 'Restore',
  'tb.close': 'Close',
  'dialog.close': 'Close',
  'dialog.cancel': 'Cancel',
  'keymap.title': 'Controls',
  'keymap.dpad': 'D-pad',
  'keymap.speed': 'Speed toggle',
  'keymap.fullscreen': 'Fullscreen',
  'keymap.note':
    'Click a key box, then press the key you want. A key binds to one place only and is removed from its previous button.',
  'keymap.pressFor': 'Press a key for {button} (Esc to cancel)',
  'keymap.console': 'Console',
  'keymap.reset': 'Reset to defaults',
  'keymap.home': 'Home',
  'keymap.reserved': 'Reserved',
  'keymap.reservedKey': '{key} is reserved by the console',
  'about.title': 'About {name}',
  'about.format': '.nori format',
  'about.platform': 'Platform',
  'about.cartridge': 'Cartridge',
  'about.screen': 'Screen',
  'about.cartSdk': 'Cartridge SDK',
  'about.dataRoot': 'Data folder',
  'about.portable': 'portable',
  'info.title': 'Title',
  'info.version': 'Version',
  'info.author': 'Author',
  'info.size': 'Size',
  'info.imported': 'Imported',
  'info.lastPlayed': 'Last played',
  'lang.title': 'Language',
  'lang.en': 'English (US)',
  'lang.ko': 'Korean',
  'lang.note': 'Language of the console UI. In-game language is up to each cartridge.',
  'home.drop': 'Drop a {ext} file here',
  'car.prev': 'Previous cartridge (←)',
  'car.next': 'Next cartridge (→)',
  'car.run': 'Play {title} (Enter)',
  'car.resume': 'Resume {title} (Enter)',
  'car.paused': 'Paused · click to resume',
  'car.menu': 'Cartridge menu',
  'car.start': 'Play',
  'car.resumeBtn': 'Resume',
  'car.options': 'Options',
  'car.info': 'Info',
  'car.folder': 'Open folder',
  'car.close': 'Close game',
  'car.remove': 'Remove',
  'car.export': 'Export cartridge',
  'car.backup': 'Back up saves',
  'car.restore': 'Restore saves',
  'car.clearSaves': 'Delete saves',
  'status.exported': 'Exported to {path}',
  'status.backedUp': 'Saves written to {path}',
  'status.noSaves': '{title} has no saves',
  'status.restored': 'Restored {count} save(s)',
  'status.savesCleared': 'Deleted saves of {title}',
  'err.restore': 'No saves (*.json) in the backup file',
  'clearSaves.title': 'Delete saves',
  'clearSaves.message': 'Delete all saves of {title}. This cannot be undone.',
  'clearSaves.confirm': 'Delete',
  'restore.title': 'Restore saves',
  'restore.message': 'Overwrite saves of {title} with the backup.\nSlots: {slots}',
  'restore.confirm': 'Restore',
  'boot.booting': 'Booting {name}…',
  'boot.loading': 'Loading cartridge… ({id})',
  'boot.cannotRun': 'Cannot run cartridge: {error}',
  'boot.sdkMismatch': 'SDK mismatch: cartridge {cart}, console {console}',
  'status.opening': 'Opening {name}…',
  'status.importing': 'Importing {name}…',
  'status.imported': 'Imported {title} v{version}',
  'status.loading': 'Loading {title}…',
  'status.removed': 'Removed {title}',
  'status.closed': 'Closed {title}',
  'err.folder': 'Cannot open folder',
  'err.library': 'Cannot read library',
  'remove.title': 'Remove cartridge',
  'remove.message':
    'Remove {title} v{version} from the library.\nSaves are kept (Tools → Open games folder).',
  'remove.confirm': 'Remove',
  'close.title': 'Close game',
  'close.message': 'Close {title}. Unsaved progress will be lost.',
  'close.confirm': 'Close',
};

const tables: Record<Lang, Record<MessageKey, string>> = { ko, en };

function isLang(value: unknown): value is Lang {
  return value === 'ko' || value === 'en';
}

function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch {
    // 저장소를 못 쓰는 환경이면 브라우저 언어로
  }
  return navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

let current: Lang = initialLang();
document.documentElement.lang = current;
const listeners = new Set<(lang: Lang) => void>();

export function currentLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  document.documentElement.lang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // 저장 실패는 무시 (이번 실행에만 적용)
  }
  for (const listener of listeners) listener(lang);
}

export function onLangChange(listener: (lang: Lang) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 현재 언어 문자열. {name} 자리에 vars 를 넣는다 */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  let text: string = tables[current][key];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}
