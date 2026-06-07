'use client';

import React, { useState } from 'react';
import { useAuth } from '@/firebase';
import { 
  signInWithEmailAndPassword 
} from 'firebase/auth';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Image from 'next/image';

const LOGO_URL = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQw8oatrplLFy0o-ghLuTFtu1gKQqYtgfXw0A&s";

export default function LoginPage() {
  const auth = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleEmailLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError("Invalid email or password. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-zinc-900 via-background to-black p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="mx-auto w-20 h-20 bg-primary/20 rounded-2xl flex items-center justify-center shadow-[0_0_50px_rgba(var(--primary),0.2)] neon-glow-primary transform rotate-6 overflow-hidden border border-primary/30">
            <img src={LOGO_URL} alt="NMCH Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-4xl font-headline font-bold tracking-tighter mt-6">NMCH</h1>
          <p className="text-muted-foreground tracking-wide">Elevated Bar Operations Management</p>
        </div>

        <Card className="glass-card border-white/5">
          <CardHeader>
            <CardTitle className="text-xl font-headline">Welcome Back</CardTitle>
            <CardDescription>Enter your credentials to access the secure dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-6 bg-destructive/10 border-destructive/20 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  name="email" 
                  type="email" 
                  placeholder="manager@nmch.com" 
                  required 
                  className="bg-background/50 border-white/10" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  name="password" 
                  type="password" 
                  required 
                  className="bg-background/50 border-white/10" 
                />
              </div>
              <Button type="submit" className="w-full bg-primary text-primary-foreground neon-glow-primary font-semibold">
                Sign In
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
              Secure Terminal Access Only
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
