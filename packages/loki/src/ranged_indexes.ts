import { AvlTreeIndex } from "./avl_index";
import { ILokiComparer } from "./comparators";

/* valid range ops that the index must directly support */
export type RangedValueOperator = "$gt" | "$gte" | "$lt" | "$lte" | "$eq" | "$neq" | "$between";

export interface IRangedIndexRequest<T> {
  op: RangedValueOperator;
  val: T;
  high?: T;
}

/** Defines interface which all loki ranged indexes need to implement */
export interface IRangedIndex<T> {
  insert(id: number, val: T): void;
  update(id: number, val: T): void;
  remove(id: number): void;
  restore(tree: any): void;
  backup(): IRangedIndex<T>;

  rangeRequest(range?: IRangedIndexRequest<T>): number[];

  validateIndex(): boolean;
}

/** Hash Interface for global ranged index factory map*/
export interface IRangedIndexFactoryMap {
  [name: string]: (name: string, comparator: ILokiComparer<any>) => IRangedIndex<any>;
}

/** Map/Register of named factory functions returning IRangedIndex instances */
export let RangedIndexFactoryMap: IRangedIndexFactoryMap = {
  "avl": (name: string, comparator: ILokiComparer<any>) => { return new AvlTreeIndex(name, comparator); }
};

