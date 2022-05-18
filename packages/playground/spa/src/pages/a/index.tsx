/**
 * @title aaa
 */
import './index.css';

export const meta = {
  str: 'This is meta str',
  num: 123,
  bool: true,
  arr: ['a', 'b', { c: { d: 1 } }, 'e'],
  obj: { a: { b: 1 }, c: 2 },
};

export default function A() {
  return <div>a page</div>;
}
