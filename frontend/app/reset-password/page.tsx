import { Suspense } from 'react';
import ResetPasswordClient from './ResetPasswordClient';  // We'll create this child

export const dynamic = 'force-dynamic';  // Prevents static prerender error

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><p>Loading...</p></div>}>
      <ResetPasswordClient />
    </Suspense>
  );
}