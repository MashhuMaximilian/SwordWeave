import { publicPageStructuredData, serializeStructuredData } from '@/lib/seo/structured-data';

export function StructuredData({ path }: { path: string }) {
  const data = publicPageStructuredData(path);
  if (!data) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(data) }} />;
}
