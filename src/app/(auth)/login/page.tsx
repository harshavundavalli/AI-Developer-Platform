import { LoginButton } from "@/components/ui/login-button";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center dot-grid">
      <div className="glass rounded-2xl p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">Sign in to AI Dev Platform</h1>
        <p className="text-surface-400 mb-8">
          Connect your GitHub account to start analyzing repositories.
        </p>
        <LoginButton />
        <p className="mt-6 text-xs text-surface-500">
          We request read access to your repos. Your code is never stored permanently.
        </p>
      </div>
    </div>
  );
}
