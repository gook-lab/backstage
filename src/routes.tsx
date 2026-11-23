import type { RouteObject } from 'react-router';
import { Layout } from './pages/Layout';
import { ModulePage } from './pages/ModulePage';
import { NotFound } from './pages/NotFound';
import { Roadmap } from './pages/Roadmap';

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <Roadmap /> },
      { path: 'm/:id', element: <ModulePage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
];
