export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default function InstitutionAnalysisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="container mx-auto px-4 py-8">
      {children}
    </div>
  );
} 