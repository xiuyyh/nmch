'use client';

import React, { useState } from 'react';
import { useAuth } from '@/firebase';
import { 
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';

const LOGO_URL = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQw8oatrplLFy0o-ghLuTFtu1gKQqYtgfXw0A&s";
const HERO_IMAGE = "https://img.pikbest.com/ai/illus_our/20230427/f5a88ce53697b93b0f7a6156238ba044.jpg!w700wp";
const DEFAULT_AVATAR = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQw8oatrplLFy0o-ghLuTFtu1gKQqYtgfXw0A&s";

export default function SignupPage() {
  const auth = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, {
        displayName: name,
        photoURL: DEFAULT_AVATAR
      });
    } catch (err: any) {
      setError(err.message || "Could not create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Side: Hero Image */}
      <div className="hidden lg:block w-1/2 relative overflow-hidden bg-background">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-70"
          style={{ backgroundImage: `url(${HERO_IMAGE})` }}
          data-ai-hint="modern bar"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/10 via-background/40 to-background" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/30" />
        
        <div className="absolute bottom-12 left-12 max-w-xl z-10">
          <h2 className="text-4xl font-headline font-bold text-white tracking-tighter uppercase leading-tight">
            NMCH Structured <br/>
            <span className="text-primary">Admin Management Interface</span>
          </h2>
        </div>
      </div>

      {/* Right Side: Signup Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-background to-black">
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(var(--primary),0.2)] neon-glow-primary transform rotate-3 overflow-hidden border border-primary/30">
                <img src={LOGO_URL} alt="NMCH Logo" className="w-full h-full object-cover" />
              </div>
              <h1 className="text-6xl font-headline font-bold tracking-tighter text-white">NMCH</h1>
            </div>
          </div>

          <Card className="glass-card border-white/5 backdrop-blur-2xl">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-headline font-bold">Create Account</CardTitle>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-6 bg-destructive/10 border-destructive/20 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSignup} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs uppercase tracking-[0.2em] font-bold text-primary/70">Full Name</Label>
                  <Input 
                    id="name" 
                    name="name" 
                    placeholder="John Doe" 
                    required 
                    className="bg-white/5 border-white/10 h-12 focus:border-primary/50 transition-colors" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs uppercase tracking-[0.2em] font-bold text-primary/70">Email Address</Label>
                  <Input 
                    id="email" 
                    name="email" 
                    type="email" 
                    placeholder="staff@nmch.com" 
                    required 
                    className="bg-white/5 border-white/10 h-12 focus:border-primary/50 transition-colors" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-xs uppercase tracking-[0.2em] font-bold text-primary/70">Password</Label>
                    <Input 
                      id="password" 
                      name="password" 
                      type="password" 
                      placeholder="••••••••"
                      required 
                      className="bg-white/5 border-white/10 h-12 focus:border-primary/50 transition-colors" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-xs uppercase tracking-[0.2em] font-bold text-primary/70">Confirm</Label>
                    <Input 
                      id="confirmPassword" 
                      name="confirmPassword" 
                      type="password" 
                      placeholder="••••••••"
                      required 
                      className="bg-white/5 border-white/10 h-12 focus:border-primary/50 transition-colors" 
                    />
                  </div>
                </div>
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full h-14 bg-primary text-primary-foreground neon-glow-primary font-bold text-lg hover:opacity-90 transition-all active:scale-[0.98]"
                >
                  {loading ? "Creating Account..." : "Sign Up"}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link href="/login" className="text-primary font-bold hover:underline">
                    Sign In
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground/40 uppercase tracking-[0.3em]">
            Authorized Personnel Only
          </p>
        </div>
      </div>
    </div>
  );
}
