export const redactEmail = (value: string) => value.replace(/^(.).+(@.+)$/, '$1***$2');
export const redactIp = (value: string) => value.replace(/(\d+\.\d+\.\d+)\.\d+/, '$1.*');
export const redactSecret = (value: string) => value.length <= 8 ? '***' : `${value.slice(0, 3)}***${value.slice(-2)}`;
