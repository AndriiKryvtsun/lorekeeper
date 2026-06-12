// The single typed PORT for the `ping` capability. Isomorphic. One interface per
// capability — never widened to cover unrelated APIs.
export interface PingPort {
  ping(message: string): Promise<PingResult>;
}

export type PingResult = {
  provider: string;
  echo: string;
};
