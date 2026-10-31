import React, { useState } from 'react';
import { ShieldCheck, LogIn, UserPlus, KeyRound, Mail, User, AlertCircle, Sparkles } from 'lucide-react';
import { api } from '../api/client';
import { UserRecord } from '../types';

interface LoginPageProps {
  onLoginSuccess: (user: UserRecord) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState<string>('engineer@traceiq.io');
  const [password, setPassword] = useState<string>('traceiq123');
  const [name, setName] = useState<string>('Incident Responder');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const res = await api.login(email, password);
        onLoginSuccess(res.user);
      } else {
        const res = await api.register(email, password, name);
        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setEmail('engineer@traceiq.io');
    setPassword('traceiq123');
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.login('engineer@traceiq.io', 'traceiq123');
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        padding: '24px'
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '36px',
          boxShadow: 'var(--shadow-md)',
          borderRadius: 'var(--radius-md)'
        }}
      >
        {/* Brand header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--accent-forest)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}
          >
            <ShieldCheck size={28} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
            TraceIQ
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Evidence-Based Incident Investigator • Grounded in MongoDB & Gemini
          </p>
        </div>

        {/* Tab switch */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-sm)',
            padding: '3px',
            marginBottom: '20px'
          }}
        >
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); }}
            style={{
              flex: 1,
              padding: '8px',
              fontSize: '13px',
              fontWeight: mode === 'login' ? '600' : '500',
              backgroundColor: mode === 'login' ? 'var(--bg-surface)' : 'transparent',
              color: mode === 'login' ? 'var(--text-primary)' : 'var(--text-muted)',
              border: 'none',
              borderRadius: 'calc(var(--radius-sm) - 2px)',
              cursor: 'pointer',
              boxShadow: mode === 'login' ? 'var(--shadow-sm)' : 'none'
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(null); }}
            style={{
              flex: 1,
              padding: '8px',
              fontSize: '13px',
              fontWeight: mode === 'register' ? '600' : '500',
              backgroundColor: mode === 'register' ? 'var(--bg-surface)' : 'transparent',
              color: mode === 'register' ? 'var(--text-primary)' : 'var(--text-muted)',
              border: 'none',
              borderRadius: 'calc(var(--radius-sm) - 2px)',
              cursor: 'pointer',
              boxShadow: mode === 'register' ? 'var(--shadow-sm)' : 'none'
            }}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              fontSize: '13px',
              marginBottom: '18px'
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {mode === 'register' && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                Full Name
              </label>
              <div style={{ position: 'relative' }}>
                <User size={15} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  required
                  placeholder="Alex Rivera"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: '100%', paddingLeft: '36px' }}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
              Work Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
              <input
                type="email"
                required
                placeholder="engineer@traceiq.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', paddingLeft: '36px' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <KeyRound size={15} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', paddingLeft: '36px' }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading}
            style={{ width: '100%', justifyContent: 'center', marginTop: '6px', height: '40px' }}
          >
            {isLoading ? (
              <span>Authenticating...</span>
            ) : mode === 'login' ? (
              <>
                <LogIn size={15} /> Sign In to TraceIQ
              </>
            ) : (
              <>
                <UserPlus size={15} /> Create Account
              </>
            )}
          </button>
        </form>

        {/* Demo Fast Login Divider */}
        <div style={{ margin: '24px 0 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-light)' }} />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Demo Access</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-light)' }} />
        </div>

        <button
          type="button"
          onClick={handleDemoLogin}
          disabled={isLoading}
          className="btn btn-secondary"
          style={{ width: '100%', justifyContent: 'center', height: '38px', borderColor: 'var(--accent-forest)' }}
        >
          <Sparkles size={14} style={{ color: 'var(--accent-forest)' }} />
          Quick 1-Click Demo Login
        </button>

        <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '16px' }}>
          Demo credentials: <strong>engineer@traceiq.io</strong> / <strong>traceiq123</strong>
        </p>
      </div>
    </div>
  );
};
