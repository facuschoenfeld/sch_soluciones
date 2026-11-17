import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { queryClient } from '@/lib/query-client';
import { router } from '@/router';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('No se encontró el elemento #root');

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
