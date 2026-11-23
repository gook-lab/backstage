import { module as nPlusOne } from './n-plus-one';
import { module as pagination } from './pagination';
import { module as transactions } from './transactions';
import type { StudyModule } from './types';

export const MODULES: readonly StudyModule[] = [pagination, nPlusOne, transactions].sort((a, b) => a.order - b.order);

export const moduleById = (id: string | undefined): StudyModule | undefined => MODULES.find((m) => m.id === id);
