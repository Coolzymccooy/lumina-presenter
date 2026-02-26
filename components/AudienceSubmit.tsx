import React, { useState } from 'react';
import { AudienceCategory, submitAudienceMessage } from '../services/serverApi';
import {
    ChatIcon,
    SparklesIcon,
    HelpIcon,
    HeartIcon,
    UserIcon,
    CheckCircleIcon
} from './Icons';

interface AudienceSubmitProps {
    workspaceId: string;
}

const CATEGORIES: { id: AudienceCategory; label: string; icon: any; color: string }[] = [
    { id: 'qa', label: 'Q&A / Question', icon: HelpIcon, color: 'bg-blue-600' },
    { id: 'prayer', label: 'Prayer Request', icon: HeartIcon, color: 'bg-rose-600' },
    { id: 'testimony', label: 'Testimony', icon: SparklesIcon, color: 'bg-purple-600' },
    { id: 'welcome', label: 'Welcome Note', icon: UserIcon, color: 'bg-emerald-600' },
    { id: 'poll', label: 'Reaction / Poll', icon: ChatIcon, color: 'bg-amber-600' },
];

export const AudienceSubmit: React.FC<AudienceSubmitProps> = ({ workspaceId }) => {
    const [category, setCategory] = useState<AudienceCategory>('qa');
    const [text, setText] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim()) return;

        setLoading(true);
        setError(null);
        try {
            const res = await submitAudienceMessage(workspaceId, {
                category,
                text: text.trim(),
                name: name.trim() || undefined
            });

            if (res?.ok) {
                setSubmitted(true);
                setText('');
                setName('');
            } else {
                setError('Failed to send message. Please try again.');
            }
        } catch (err) {
            setError('Network error. Check your connection.');
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
                <CheckCircleIcon className="w-20 h-20 text-emerald-500 mb-4" />
                <h1 className="text-2xl font-bold mb-2">Message Sent!</h1>
                <p className="text-zinc-400 mb-8 max-w-xs">
                    Thank you for sharing. Your message has been sent to the production team.
                </p>
                <button
                    onClick={() => setSubmitted(false)}
                    className="bg-white text-black font-bold py-3 px-8 rounded-full hover:bg-zinc-200 transition-colors"
                >
                    Send Another
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white p-6 pb-12 font-sans selection:bg-blue-500/30">
            <div className="max-w-md mx-auto">
                <header className="mb-10 text-center">
                    <div className="inline-block p-3 bg-zinc-900 rounded-2xl mb-4 border border-zinc-800 shadow-xl">
                        <ChatIcon className="w-10 h-10 text-blue-500" />
                    </div>
                    <h1 className="text-3xl font-black tracking-tighter uppercase italic">Audience Studio</h1>
                    <p className="text-zinc-500 text-sm mt-1">Submit your message for the screen</p>
                </header>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Category Selector */}
                    <section>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">
                            Select Category
                        </label>
                        <div className="grid grid-cols-1 gap-3">
                            {CATEGORIES.map((cat) => {
                                const Icon = cat.icon;
                                const isSelected = category === cat.id;
                                return (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => setCategory(cat.id)}
                                        className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${isSelected
                                                ? `${cat.color} border-transparent shadow-lg scale-[1.02]`
                                                : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                                            }`}
                                    >
                                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-white/20' : 'bg-zinc-800'}`}>
                                            <Icon className={`w-6 h-6 ${isSelected ? 'text-white' : 'text-zinc-400'}`} />
                                        </div>
                                        <span className={`font-bold text-lg ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                                            {cat.label}
                                        </span>
                                        {isSelected && (
                                            <div className="ml-auto">
                                                <CheckCircleIcon className="w-6 h-6 text-white/50" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    {/* Message Input */}
                    <section className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                                Your Message
                            </label>
                            <textarea
                                required
                                rows={4}
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="What's on your mind?..."
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-white placeholder:text-zinc-700 focus:outline-none focus:border-blue-600 transition-colors resize-none"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                                Your Name <span className="text-zinc-700 font-normal normal-case">(Optional)</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Name"
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-white placeholder:text-zinc-700 focus:outline-none focus:border-blue-600 transition-colors"
                            />
                        </div>
                    </section>

                    {error && (
                        <div className="p-4 bg-rose-950/20 border border-rose-900/50 text-rose-500 rounded-xl text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !text.trim()}
                        className={`w-full py-5 rounded-2xl text-xl font-black uppercase tracking-tight transition-all active:scale-95 shadow-2xl ${loading
                                ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                                : 'bg-gradient-to-br from-blue-600 to-blue-700 text-white hover:shadow-blue-900/20'
                            }`}
                    >
                        {loading ? 'Sending...' : 'Submit Message'}
                    </button>
                </form>

                <footer className="mt-16 text-center opacity-20 hover:opacity-100 transition-opacity">
                    <p className="text-[10px] uppercase tracking-[0.2em] font-bold">Powered by Lumina Studio</p>
                </footer>
            </div>
        </div>
    );
};
