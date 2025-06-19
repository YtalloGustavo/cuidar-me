import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Pill, CheckCircle, Circle, X, Pencil, RotateCw, LayoutDashboard, Calendar, MessageSquare, LogOut, User, Lock } from 'lucide-react';

import { 
    initializeApp 
} from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut
} from 'firebase/auth';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    doc, 
    deleteDoc, 
    updateDoc,
    Timestamp,
    arrayUnion,
    arrayRemove
} from 'firebase/firestore';

// --- Configuração do Firebase ---
const firebaseConfig = { 
    apiKey: "AIzaSyC3b8B8JwT0rNOUKCsU4AqsTp-HRtrzBAc",
    authDomain: "cuidar-me-61cd6.firebaseapp.com",
    projectId: "cuidar-me-61cd6",
    storageBucket: "cuidar-me-61cd6.appspot.com",
    messagingSenderId: "755264445663",
    appId: "1:755264445663:web:be13f35a8e7f8241201d6a"
};
const appId = 'default-med-tracker';

// --- Lógica de Frequência ---
const isSameDay = (d1, d2) => d1 && d2 && d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
const getDayWithoutTime = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const wasDueOnDate = (med, date) => {
    const { frequencyType, frequencyValue, createdAt } = med;
    const checkDate = getDayWithoutTime(date);
    if (!createdAt || checkDate < getDayWithoutTime(createdAt.toDate())) return false;
    switch (frequencyType) {
        case 'daily': return true;
        case 'weekly': return checkDate.getDay() === parseInt(frequencyValue, 10);
        case 'monthly': return checkDate.getDate() === parseInt(frequencyValue, 10);
        case 'interval': {
            if (!frequencyValue) return false;
            const interval = parseInt(frequencyValue, 10);
            const startDate = getDayWithoutTime(createdAt.toDate());
            const diffTime = Math.abs(checkDate.getTime() - startDate.getTime());
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            return diffDays % interval === 0;
        }
        default: return true;
    }
};

// --- Componente de Autenticação ---
const AuthComponent = ({ auth }) => {
    const [authView, setAuthView] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleAuthAction = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (authView === 'signup') await createUserWithEmailAndPassword(auth, email, password);
            else await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            switch (err.code) {
                case 'auth/email-already-in-use': setError('Este email já está em uso.'); break;
                case 'auth/invalid-email': setError('Formato de email inválido.'); break;
                case 'auth/weak-password': setError('A senha deve ter pelo menos 6 caracteres.'); break;
                case 'auth/invalid-credential': setError('Email ou senha incorretos.'); break;
                default: setError('Ocorreu um erro. Tente novamente.'); break;
            }
        }
    };
    
    return (
        <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <header className="text-center mb-8"><h1 className="text-4xl font-bold text-cyan-400">Painel de Remédios</h1><p className="text-gray-400 mt-2">Bem-vindo(a)!</p></header>
                <div className="bg-gray-800 p-8 rounded-xl shadow-lg">
                    <h2 className="text-2xl font-bold text-center mb-6">{authView === 'login' ? 'Fazer Login' : 'Criar Conta'}</h2>
                    <form onSubmit={handleAuthAction} className="space-y-6">
                        <div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20}/><input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-gray-700 rounded-lg pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500" required /></div>
                        <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20}/><input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-gray-700 rounded-lg pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500" required /></div>
                        {error && <p className="text-red-400 text-sm text-center bg-red-500/10 p-2 rounded-lg">{error}</p>}
                        <button type="submit" className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 rounded-lg font-bold transition-colors">{authView === 'login' ? 'Entrar' : 'Cadastrar'}</button>
                    </form>
                    <p className="text-center text-sm text-gray-400 mt-6">{authView === 'login' ? 'Não tem uma conta? ' : 'Já tem uma conta? '}<button onClick={() => setAuthView(authView === 'login' ? 'signup' : 'login')} className="font-semibold text-cyan-400 hover:underline">{authView === 'login' ? 'Cadastre-se' : 'Faça Login'}</button></p>
                </div>
            </div>
        </div>
    );
};

// --- Componente da Aplicação Principal (Logado) ---
const MainApp = ({ user, db, auth }) => {
    const [activeView, setActiveView] = useState('dashboard');
    const [medications, setMedications] = useState([]);
    const [showMedModal, setShowMedModal] = useState(false);
    const [showNoteModal, setShowNoteModal] = useState(false);
    const [editingMed, setEditingMed] = useState(null);
    const [editingNoteForDose, setEditingNoteForDose] = useState(null);
    const [currentNote, setCurrentNote] = useState('');
    
    const [medName, setMedName] = useState('');
    const [medDosage, setMedDosage] = useState('');
    const [medTime, setMedTime] = useState('');
    const [frequencyType, setFrequencyType] = useState('daily');
    const [frequencyValue, setFrequencyValue] = useState('');

    useEffect(() => {
        if (!user || !db) return;
        const medsCollectionRef = collection(db, `artifacts/${appId}/users/${user.uid}/medications`);
        const unsubscribe = onSnapshot(medsCollectionRef, (snapshot) => {
            setMedications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return unsubscribe;
    }, [user, db]);

    const handleLogout = () => signOut(auth);

    const handleOpenAddModal = () => { setEditingMed(null); setMedName(''); setMedDosage(''); setMedTime(''); setFrequencyType('daily'); setFrequencyValue(''); setShowMedModal(true); };
    const handleOpenEditModal = (med) => { setEditingMed(med); setMedName(med.name); setMedDosage(med.dosage || ''); setMedTime(med.time); setFrequencyType(med.frequencyType || 'daily'); setFrequencyValue(med.frequencyValue || ''); setShowMedModal(true); };
    const handleOpenNoteModal = (med, dose) => { setEditingNoteForDose({ medId: med.id, dose }); setCurrentNote(dose.note || ''); setShowNoteModal(true); };

    const handleSubmitMedForm = async (e) => {
        e.preventDefault();
        const collectionRef = collection(db, `artifacts/${appId}/users/${user.uid}/medications`);
        const data = { name: medName, dosage: medDosage, time: medTime, frequencyType, frequencyValue };
        if (editingMed) await updateDoc(doc(collectionRef, editingMed.id), data);
        else await addDoc(collectionRef, { ...data, createdAt: Timestamp.now(), takenDoses: [] });
        setShowMedModal(false);
    };

    const handleTakeMedication = async (med) => await updateDoc(doc(db, `artifacts/${appId}/users/${user.uid}/medications`, med.id), { takenDoses: arrayUnion({ date: Timestamp.now(), note: "" }) });
    const handleUntakeMedication = async (med) => {
        const doseToRemove = med.takenDoses.find(d => isSameDay(d.date.toDate(), new Date()));
        if(doseToRemove) await updateDoc(doc(db, `artifacts/${appId}/users/${user.uid}/medications`, med.id), { takenDoses: arrayRemove(doseToRemove) });
    };
    const handleDeleteMedication = async (id) => await deleteDoc(doc(db, `artifacts/${appId}/users/${user.uid}/medications`, id));
    const handleSaveNote = async (e) => {
        e.preventDefault();
        const { medId, dose } = editingNoteForDose;
        const medRef = doc(db, `artifacts/${appId}/users/${user.uid}/medications`, medId);
        await updateDoc(medRef, { takenDoses: arrayRemove(dose) });
        await updateDoc(medRef, { takenDoses: arrayUnion({ ...dose, note: currentNote }) });
        setShowNoteModal(false);
    };

    const DashboardView = () => {
        const today = new Date();
        const medsDue = medications.filter(med => wasDueOnDate(med, today) && !med.takenDoses.some(d=>isSameDay(d.date.toDate(), today))).sort((a,b) => a.time.localeCompare(b.time));
        const medsTaken = medications.filter(med => med.takenDoses.some(d => isSameDay(d.date.toDate(), today))).sort((a,b) => a.time.localeCompare(b.time));

        return (
            <>
                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-4 text-gray-300 flex items-center"><Circle className="w-5 h-5 mr-3 text-yellow-400"/>Para Tomar Hoje ({medsDue.length})</h2>
                    {medsDue.map(med => (
                        <div key={med.id} className="bg-gray-800 rounded-lg p-4 flex items-center justify-between shadow-lg border border-gray-700 mb-3">
                            <div><p className="font-bold">{med.name}</p><p className="text-sm text-gray-400">{med.dosage} &bull; {med.time}</p></div>
                            <div className="flex items-center space-x-2">
                                <button onClick={() => handleTakeMedication(med)} className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-full"><CheckCircle size={20} /></button>
                                <button onClick={() => handleOpenEditModal(med)} className="text-gray-400 hover:text-cyan-400 p-2 rounded-full"><Pencil size={20} /></button>
                                <button onClick={() => handleDeleteMedication(med.id)} className="text-gray-400 hover:text-red-400 p-2 rounded-full"><Trash2 size={20} /></button>
                            </div>
                        </div>
                    ))}
                    {medsDue.length === 0 && <p className="text-gray-500 text-center mt-4">Nenhum remédio para hoje.</p>}
                </section>
                <section>
                    <h2 className="text-xl font-semibold mb-4 text-gray-300 flex items-center"><CheckCircle className="w-5 h-5 mr-3 text-green-400"/>Já Tomados Hoje ({medsTaken.length})</h2>
                    {medsTaken.map(med => {
                        const dose = med.takenDoses.find(d => isSameDay(d.date.toDate(), new Date()));
                        return (
                            <div key={med.id} className="bg-gray-800/60 rounded-lg p-4 opacity-70 mb-3">
                                <div className="flex items-center justify-between">
                                    <div><p className="font-bold line-through">{med.name}</p><p className="text-sm text-gray-500">{med.dosage} &bull; {med.time}</p></div>
                                    <div className="flex items-center space-x-2">
                                        <button onClick={() => handleOpenNoteModal(med, dose)} className="text-gray-400 hover:text-blue-400 p-2 rounded-full"><MessageSquare size={20} /></button>
                                        <button onClick={() => handleUntakeMedication(med)} className="text-gray-400 hover:text-yellow-400 p-2 rounded-full"><RotateCw size={20} /></button>
                                        <button onClick={() => handleDeleteMedication(med.id)} className="text-gray-600 hover:text-red-400 p-2 rounded-full"><Trash2 size={20} /></button>
                                    </div>
                                </div>
                                {dose && dose.note && <p className="text-sm text-gray-300 mt-2 pl-2 border-l-2 border-blue-500/50">Nota: {dose.note}</p>}
                            </div>
                        )
                    })}
                </section>
                <button onClick={handleOpenAddModal} className="fixed bottom-24 right-6 bg-cyan-500 w-16 h-16 rounded-full flex items-center justify-center shadow-lg"><Plus size={32} /></button>
            </>
        );
    };

    const HistoryView = () => {
        const [currentDate, setCurrentDate] = useState(new Date());
        const [selectedDate, setSelectedDate] = useState(null); 
        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const daysOfWeek = ["D", "S", "T", "Q", "Q", "S", "S"];
        const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
        const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();

        const getDayStatus = (day) => {
            const today = getDayWithoutTime(new Date());
            const date = getDayWithoutTime(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
            if (date > today) return 'bg-gray-800 text-gray-500';
            const medsDueOnDay = medications.filter(med => wasDueOnDate(med, date));
            if (medsDueOnDay.length === 0) return 'bg-gray-800 text-gray-500';
            const takenCount = medsDueOnDay.filter(med => med.takenDoses.some(d => isSameDay(d.date.toDate(), date))).length;
            if (takenCount === medsDueOnDay.length) return 'bg-green-500/40 border-green-500';
            if (date < today) return 'bg-red-500/30 border-red-500';
            if (isSameDay(date, today)) return 'bg-yellow-500/40 border-yellow-500';
            return 'bg-gray-800';
        };

        const handleDayClick = (day) => {
            const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            setSelectedDate(selectedDate && isSameDay(selectedDate, clickedDate) ? null : clickedDate);
        };

        return (
            <div>
                <div className="flex justify-between items-center mb-4"><button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2 rounded-full hover:bg-gray-700">&lt;</button><h2 className="text-xl font-bold">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2><button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2 rounded-full hover:bg-gray-700">&gt;</button></div>
                <div className="grid grid-cols-7 gap-2 text-center">{daysOfWeek.map((day, index) => <div key={`weekday-${index}`} className="font-bold text-gray-400 text-sm">{day}</div>)}{Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`}></div>)}{Array.from({ length: daysInMonth }).map((_, dayIndex) => { const day = dayIndex + 1; const isSelected = selectedDate && isSameDay(selectedDate, new Date(currentDate.getFullYear(), currentDate.getMonth(), day)); return <div key={day} onClick={() => handleDayClick(day)} className={`h-10 w-10 flex items-center justify-center rounded-full border cursor-pointer transition-all ${getDayStatus(day)} ${isSelected ? 'ring-2 ring-cyan-400' : ''}`}>{day}</div> })}</div>
                {selectedDate && (
                    <div className="mt-6 p-4 bg-gray-800/50 rounded-lg">
                        <h3 className="text-lg font-semibold text-cyan-400 mb-3">Detalhes para {selectedDate.toLocaleDateString('pt-BR')}</h3>
                        <div className="space-y-2">{medications.filter(med => wasDueOnDate(med, selectedDate)).map(med => { const dose = med.takenDoses.find(d => isSameDay(d.date.toDate(), selectedDate)); return ( <div key={med.id} className="bg-gray-800 p-3 rounded-lg"><div className="flex items-center justify-between"><div className="flex items-center">{dose ? <CheckCircle className="w-5 h-5 mr-3 text-green-500"/> : <Circle className="w-5 h-5 mr-3 text-red-500"/>}<span className="truncate">{med.name}</span></div><span className="text-sm text-gray-400">{med.time}</span></div>{dose && dose.note && <p className="text-sm text-gray-300 mt-2 pl-8 border-l-2 border-blue-500/50 ml-2.5">Nota: {dose.note}</p>}</div> ); })}{medications.filter(med => wasDueOnDate(med, selectedDate)).length === 0 && <p className="text-gray-400 text-center">Nenhum remédio agendado.</p>}</div>
                    </div>
                )}
            </div>
        );
    };

    const renderFrequencyInputs = () => {
        switch (frequencyType) {
            case 'weekly': return (<div><label className="block text-sm text-gray-300 mb-1">Dia da Semana</label><select value={frequencyValue} onChange={e => setFrequencyValue(e.target.value)} className="w-full bg-gray-700 border-gray-600 rounded-lg px-3 py-2"><option value="">Selecione...</option><option value="0">Domingo</option><option value="1">Segunda</option><option value="2">Terça</option><option value="3">Quarta</option><option value="4">Quinta</option><option value="5">Sexta</option><option value="6">Sábado</option></select></div>);
            case 'monthly': return (<div><label className="block text-sm text-gray-300 mb-1">Dia do Mês (1-31)</label><input type="number" min="1" max="31" value={frequencyValue} onChange={e => setFrequencyValue(e.target.value)} className="w-full bg-gray-700 border-gray-600 rounded-lg px-3 py-2"/></div>);
            case 'interval': return (<div><label className="block text-sm text-gray-300 mb-1">A cada (dias)</label><input type="number" min="1" value={frequencyValue} onChange={e => setFrequencyValue(e.target.value)} className="w-full bg-gray-700 border-gray-600 rounded-lg px-3 py-2"/></div>);
            default: return null;
        }
    };

    return (
        <div className="bg-gray-900 text-white font-sans w-full min-h-screen flex justify-center">
             <div className="w-full max-w-md mx-auto p-4 pb-28">
                <header className="text-center my-6 relative"><h1 className="text-3xl font-bold text-cyan-400">Painel de Remédios</h1><p className="text-gray-400 text-sm mt-2">{activeView === 'dashboard' ? 'Seu controle diário' : 'Histórico de Doses'}</p><button onClick={handleLogout} className="absolute top-0 right-0 p-2 text-gray-400 hover:text-red-400" title="Sair"><LogOut size={20} /></button></header>
                <main>{activeView === 'dashboard' ? <DashboardView /> : <HistoryView />}</main>
                {showMedModal && (<div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 overflow-y-auto"><div className="bg-gray-800 rounded-xl p-6 w-full max-w-sm my-8"><h3 className="text-xl font-bold mb-4">{editingMed ? 'Editar Remédio' : 'Novo Remédio'}</h3><form onSubmit={handleSubmitMedForm} className="space-y-4"><div><label className="block text-sm">Nome*</label><input type="text" value={medName} onChange={e => setMedName(e.target.value)} className="w-full bg-gray-700 rounded px-3 py-2" required /></div><div><label className="block text-sm">Dosagem</label><input type="text" value={medDosage} onChange={e => setMedDosage(e.target.value)} className="w-full bg-gray-700 rounded px-3 py-2" /></div><div><label className="block text-sm">Horário*</label><input type="time" value={medTime} onChange={e => setMedTime(e.target.value)} className="w-full bg-gray-700 rounded px-3 py-2" required /></div><div><label className="block text-sm">Frequência</label><select value={frequencyType} onChange={e => {setFrequencyType(e.target.value); setFrequencyValue('');}} className="w-full bg-gray-700 rounded px-3 py-2"><option value="daily">Diário</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option><option value="interval">Intervalo de dias</option></select></div>{renderFrequencyInputs()}<div className="flex justify-end pt-4 space-x-3"><button type="button" onClick={() => setShowMedModal(false)} className="py-2 px-4 bg-gray-600 rounded">Cancelar</button><button type="submit" className="py-2 px-4 bg-cyan-500 rounded">{editingMed ? 'Salvar' : 'Adicionar'}</button></div></form></div></div>)}
                {showNoteModal && (<div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50"><div className="bg-gray-800 rounded-xl p-6 w-full max-w-sm"><h3 className="text-xl font-bold mb-4">Adicionar Anotação</h3><form onSubmit={handleSaveNote}><textarea value={currentNote} onChange={e => setCurrentNote(e.target.value)} className="w-full h-24 bg-gray-700 rounded px-3 py-2" placeholder="Ex: Senti dor de cabeça..."></textarea><div className="flex justify-end pt-4 space-x-3"><button type="button" onClick={() => setShowNoteModal(false)} className="py-2 px-4 bg-gray-600 rounded">Cancelar</button><button type="submit" className="py-2 px-4 bg-cyan-500 rounded">Salvar Nota</button></div></form></div></div>)}
                <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-gray-800/80 backdrop-blur-sm border-t border-gray-700"><nav className="flex justify-around p-2"><button onClick={() => setActiveView('dashboard')} className={`flex flex-col items-center p-2 rounded-lg ${activeView === 'dashboard' ? 'text-cyan-400' : 'text-gray-400'}`}><LayoutDashboard size={24} /><span className="text-xs mt-1">Painel</span></button><button onClick={() => setActiveView('history')} className={`flex flex-col items-center p-2 rounded-lg ${activeView === 'history' ? 'text-cyan-400' : 'text-gray-400'}`}><Calendar size={24} /><span className="text-xs mt-1">Histórico</span></button></nav></footer>
            </div>
        </div>
    );
};

// --- Componente Raiz ---
export default function App() {
    const [user, setUser] = useState(null);
    const [auth, setAuth] = useState(null);
    const [db, setDb] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const app = initializeApp(firebaseConfig);
        const firebaseAuth = getAuth(app);
        const firestoreDb = getFirestore(app);
        setAuth(firebaseAuth);
        setDb(firestoreDb);
        
        const unsubscribe = onAuthStateChanged(firebaseAuth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) {
        return <div className="bg-gray-900 min-h-screen flex items-center justify-center text-white">Carregando...</div>;
    }

    return user ? <MainApp user={user} db={db} auth={auth} /> : <AuthComponent auth={auth} />;
}
