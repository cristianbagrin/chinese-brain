declare module '*.css' {
  const text: string;
  export default text;
}

interface CaretPosition {
  readonly offsetNode: Node;
  readonly offset: number;
}
interface Document {
  caretPositionFromPoint?(x: number, y: number): CaretPosition | null;
}
