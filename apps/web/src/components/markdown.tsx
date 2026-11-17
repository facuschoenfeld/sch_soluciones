import ReactMarkdown, { type Components } from 'react-markdown';

// react-markdown no renderiza HTML crudo (con skipHtml ni siquiera lo muestra como texto) y
// descarta URLs peligrosas (javascript:, data:…), así que el markdown del panel no abre XSS.
// Las imágenes no se cargan: serían recursos de terceros (con la IP del visitante) y no hay
// disco donde alojarlas. Los títulos se bajan de nivel: la página ya tiene h1 y h2.
const components: Components = {
  h1: ({ node: _node, ...props }) => <h3 {...props} />,
  h2: ({ node: _node, ...props }) => <h3 {...props} />,
  h3: ({ node: _node, ...props }) => <h4 {...props} />,
  h4: ({ node: _node, ...props }) => <h4 {...props} />,
  h5: ({ node: _node, ...props }) => <h4 {...props} />,
  h6: ({ node: _node, ...props }) => <h4 {...props} />,
  // En lugar de la imagen se deja su texto alternativo (así un link con imagen conserva nombre).
  img: ({ alt }) => (alt ? <span>{alt}</span> : null),
  // Solo los links externos se abren en otra pestaña.
  a: ({ node: _node, href, ...props }) =>
    href && /^https?:\/\//i.test(href) ? (
      <a href={href} {...props} target="_blank" rel="noopener noreferrer" />
    ) : (
      <a href={href} {...props} />
    ),
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown skipHtml components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
