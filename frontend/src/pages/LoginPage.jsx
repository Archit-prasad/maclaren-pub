import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerUser, loginUser } from '../api/auth';
import { useAuth } from '../contexts/AuthContext';

// ─── Password strength ────────────────────────────────────────────────────────
function passwordStrength(pw) {
  if (!pw) return null;
  if (pw.length < 6) return { label: 'Classic Schmosby...', color: 'text-red-400' };
  const strong = /[A-Z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw) && pw.length >= 10;
  if (strong) return { label: 'Legendary!', color: 'text-green-400' };
  return { label: 'Suit Up!', color: 'text-yellow-400' };
}

// ─── Floating label input ─────────────────────────────────────────────────────
function FloatingInput({ id, label, type = 'text', value, onChange, autoComplete, rightSlot }) {
  return (
    <div className="floating-label-group relative mb-5">
      <input
        id={id}
        type={type}
        placeholder=" "
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        className="input-glow w-full bg-transparent border border-white/20 rounded-lg px-4 pt-5 pb-2 text-white text-sm focus:outline-none transition-all peer"
      />
      <label
        htmlFor={id}
        className="absolute left-4 top-3.5 text-white/50 text-sm pointer-events-none"
      >
        {label}
      </label>
      {rightSlot && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [fields, setFields] = useState({
    display_name: '', gender: '', email: '', password: '', confirmPassword: '',
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarResolved, setAvatarResolved] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [windowBright, setWindowBright] = useState(false);
  const [flickering, setFlickering] = useState(false);
  const imageRef = useRef(null);
  const fileInputRef = useRef(null);

  const set = (key) => (e) => setFields((f) => ({ ...f, [key]: e.target.value }));

  // ── Mouse tracking for window glow ──────────────────────────────────────────
  const handleMouseMove = useCallback((e) => {
    setWindowBright(e.clientX > window.innerWidth / 2);
  }, []);
  const handleMouseLeave = useCallback(() => setWindowBright(false), []);

  // ── Password visibility flicker ─────────────────────────────────────────────
  const togglePassword = () => {
    if (!showPassword) {
      setFlickering(true);
      setTimeout(() => setFlickering(false), 700);
    }
    setShowPassword((s) => !s);
  };

  // ── Avatar selection ─────────────────────────────────────────────────────────
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarResolved(false);
  };

  // ── Toast helper ─────────────────────────────────────────────────────────────
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (isLoading) return;

    if (mode === 'register') {
      if (fields.password !== fields.confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (!fields.gender) {
        setError('Please select a gender.');
        return;
      }
    }

    setIsLoading(true);
    try {
      let data;
      if (mode === 'login') {
        data = await loginUser({ email: fields.email, password: fields.password });
      } else {
        data = await registerUser({
          display_name: fields.display_name,
          gender: fields.gender,
          email: fields.email,
          password: fields.password,
          avatarFile,
        });
      }

      login(data.token, data.user);

      if (mode === 'register' && avatarPreview) {
        setAvatarResolved(true);
        setTimeout(() => {
          showToast(`Legendary! Welcome to MacLaren's, ${data.user.display_name}!`);
          navigate('/pub');
        }, 900);
      } else {
        showToast(`Welcome back, ${data.user.display_name}!`);
        setTimeout(() => navigate('/pub'), 800);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Something went wrong. Try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const strength = mode === 'register' ? passwordStrength(fields.password) : null;

  return (
    <div
      className="min-h-screen flex items-center justify-center overflow-hidden relative"
      style={{ backgroundColor: '#0d1f14' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* ── Cloud drift overlay ─────────────────────────────────────────────── */}
      <div
        className="cloud-drift pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(ellipse 80px 40px at 20% 15%, white 0%, transparent 70%), radial-gradient(ellipse 120px 50px at 65% 8%, white 0%, transparent 70%), radial-gradient(ellipse 60px 30px at 85% 20%, white 0%, transparent 70%)',
          backgroundSize: '400% 100%',
        }}
      />

      {/* ── Pub exterior image ──────────────────────────────────────────────── */}
      <div className="pub-bg-animate absolute inset-0 flex items-center justify-center">
        <div className="relative w-full max-w-3xl mx-auto px-4" style={{ maxHeight: '90vh' }}>
          <img
            ref={imageRef}
            src="/assets/image_3d0b4a.jpg"
            alt="MacLaren's Pub"
            className={`w-full h-auto object-contain rounded-xl select-none transition-all duration-700
              ${flickering ? 'flicker-glow' : ''}
              ${windowBright ? 'brightness-110' : 'brightness-90'}`}
            style={{ transition: flickering ? undefined : 'filter 0.6s ease' }}
            draggable={false}
          />

          {/* String lights swaying */}
          <div className="sway-lights pointer-events-none absolute top-0 left-0 right-0 h-10 flex items-end justify-center gap-6 px-8 opacity-70">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: ['#fbbf24','#f87171','#34d399','#60a5fa','#c084fc'][i % 5],
                  boxShadow: `0 0 6px 2px ${['#fbbf2480','#f8717180','#34d39980','#60a5fa80','#c084fc80'][i % 5]}`,
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>

          {/* Sidewalk glow spill */}
          {windowBright && (
            <div
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-0 w-48 h-12 rounded-full opacity-20 blur-2xl transition-opacity duration-700"
              style={{ background: 'radial-gradient(ellipse, #fbbf24 0%, transparent 80%)' }}
            />
          )}
        </div>
      </div>

      {/* ── Frosted glass card ──────────────────────────────────────────────── */}
      <div className="card-slide-up glass-card relative z-10 w-full max-w-sm mx-4 rounded-2xl p-8 shadow-2xl">
        {/* Logo / title */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white tracking-wide">MacLaren's Pub</h1>
          <p className="text-white/50 text-xs mt-1 tracking-widest uppercase">
            {mode === 'login' ? 'The Gang Awaits' : 'Join the Gang'}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg overflow-hidden border border-white/10 mb-6">
          {['login', 'register'].map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors duration-200
                ${mode === m ? 'bg-green-700/60 text-white' : 'text-white/40 hover:text-white/70'}`}
            >
              {m === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* Register-only fields */}
          <div
            style={{
              maxHeight: mode === 'register' ? '600px' : '0px',
              overflow: 'hidden',
              transition: 'max-height 0.5s cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            {/* Avatar upload */}
            <div className="flex flex-col items-center mb-5">
              <div
                className="relative w-20 h-20 rounded-full cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarPreview ? (
                  <>
                    {!avatarResolved && (
                      <img
                        src={avatarPreview}
                        alt="avatar"
                        className="w-20 h-20 rounded-full object-cover spin-fall absolute inset-0"
                        onAnimationEnd={() => {}}
                      />
                    )}
                    <img
                      src={avatarPreview}
                      alt="avatar"
                      className={`w-20 h-20 rounded-full object-cover ${avatarResolved ? 'avatar-resolve' : 'opacity-0'}`}
                    />
                  </>
                ) : (
                  <div className="w-20 h-20 rounded-full bg-white/10 border-2 border-dashed border-white/25 flex items-center justify-center text-white/30 text-xs text-center group-hover:border-green-500/60 transition-colors">
                    <span>Photo</span>
                  </div>
                )}
              </div>
              <p className="text-white/30 text-xs mt-2">Click to upload photo</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            <FloatingInput id="display_name" label="Username" value={fields.display_name} onChange={set('display_name')} />

            {/* Gender dropdown */}
            <div className="relative mb-5">
              <select
                value={fields.gender}
                onChange={set('gender')}
                className="input-glow w-full bg-[#0d1f14] border border-white/20 rounded-lg px-4 py-3 text-sm text-white focus:outline-none appearance-none"
              >
                <option value="" disabled className="text-white/40">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/30">▾</div>
            </div>
          </div>

          {/* Shared fields */}
          <FloatingInput id="email" label="Email" type="email" value={fields.email} onChange={set('email')} autoComplete="email" />

          <FloatingInput
            id="password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={fields.password}
            onChange={set('password')}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            rightSlot={
              <button
                type="button"
                onClick={togglePassword}
                className="text-white/40 hover:text-white/70 text-lg leading-none transition-colors"
                tabIndex={-1}
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            }
          />

          {/* Password strength */}
          {mode === 'register' && strength && (
            <p className={`-mt-3 mb-4 text-xs ${strength.color}`}>{strength.label}</p>
          )}

          {/* Confirm password */}
          <div
            style={{
              maxHeight: mode === 'register' ? '80px' : '0px',
              overflow: 'hidden',
              transition: 'max-height 0.4s ease',
            }}
          >
            <FloatingInput id="confirmPassword" label="Confirm Password" type="password" value={fields.confirmPassword} onChange={set('confirmPassword')} autoComplete="new-password" />
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-400 text-xs mb-3 text-center">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-green-700 hover:bg-green-600 active:scale-95 text-white font-semibold text-sm tracking-wide transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-green-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'One moment...' : 'Enter the Pub'}
          </button>

          {/* Forgot password link */}
          {mode === 'login' && (
            <p className="text-center mt-4">
              <button
                type="button"
                onClick={() => showToast('Password reset coming soon. Have you tried being Barney?')}
                className="text-white/30 hover:text-green-400 text-xs transition-colors"
              >
                Lost your Yellow Umbrella?
              </button>
            </p>
          )}
        </form>
      </div>

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-green-800/90 backdrop-blur text-white text-sm px-5 py-3 rounded-xl shadow-xl border border-green-600/30 max-w-xs text-center">
          {toast}
        </div>
      )}
    </div>
  );
}
