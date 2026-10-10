/**
 * 콘솔 마스터 볼륨.
 *
 * 카트리지(Phaser 등)가 만드는 모든 Web Audio 출력은 `context.destination` 으로 connect 된다.
 * 콘솔은 부팅할 때 AudioNode.prototype.connect 를 감싸서, destination 으로 가는 연결을
 * 컨텍스트마다 하나씩 둔 GainNode 를 거치게 한다. 카트리지는 아무것도 몰라도 되고 SDK 도 바뀌지 않는다.
 * <audio> 요소로 직접 재생하는 소리는 Web Audio 가 아니라 여기서 줄이지 못한다.
 */
const masters = new WeakMap<BaseAudioContext, GainNode>();
const masterNodes = new Set<GainNode>();
let volume = 1;
let installed = false;

type Connect = typeof AudioNode.prototype.connect;

function masterFor(context: BaseAudioContext, realConnect: Connect): GainNode {
  let gain = masters.get(context);
  if (!gain) {
    gain = context.createGain();
    gain.gain.value = volume;
    (realConnect as (this: AudioNode, node: AudioNode) => AudioNode).call(
      gain,
      context.destination,
    );
    masters.set(context, gain);
    masterNodes.add(gain);
  }
  return gain;
}

/** 카트리지를 로드하기 전에 한 번 설치한다 */
export function installMasterVolume(initial: number): void {
  if (installed || typeof AudioNode === 'undefined') return;
  installed = true;
  volume = clamp(initial);
  const realConnect = AudioNode.prototype.connect;
  const patched = function (this: AudioNode, destination: unknown, ...rest: unknown[]) {
    const target =
      destination instanceof AudioDestinationNode
        ? masterFor(this.context, realConnect)
        : destination;
    return (realConnect as (...args: unknown[]) => unknown).apply(this, [target, ...rest]);
  };
  AudioNode.prototype.connect = patched as Connect;
}

export function setMasterVolume(value: number): void {
  volume = clamp(value);
  for (const gain of masterNodes) gain.gain.value = volume;
}

function clamp(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
}
