import { createBrowserRouter } from 'react-router';
import { RootLayout } from '@/components/layout/root-layout';
import { ContactPage } from '@/pages/contact-page';
import { HomePage } from '@/pages/home-page';
import { NotFoundPage } from '@/pages/not-found-page';
import { ServiceDetailPage } from '@/pages/service-detail-page';
import { ServicesPage } from '@/pages/services-page';

// Rutas visibles en español; el código y la API siguen en inglés.
export const routes = [
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'servicios', element: <ServicesPage /> },
      { path: 'servicios/:slug', element: <ServiceDetailPage /> },
      { path: 'contacto', element: <ContactPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
