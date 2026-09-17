declare module "circomlibjs" {
  export function buildEddsa(): Promise<any>;
  export function buildPoseidon(): Promise<any>;
}
declare module "process" {
  const process: { env: Record<string, string | undefined>; browser?: boolean };
  export default process;
}
