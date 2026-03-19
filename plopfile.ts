import type { NodePlopAPI } from 'plop';
import { initPlop } from './src/lib/plops/init';

export default function (plop: NodePlopAPI) {
  initPlop(plop, "init");
}