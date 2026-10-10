import React, { useState } from 'react';
import { api } from '../api';
import { ArrowLeft, Check, ShieldAlert } from 'lucide-react';

export default function SilentDistress({ activeTrip, onClose }) {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState(null);
  const [operator, setOperator] = useState(null);
  const [isNewNumber, setIsNewNumber] = useState(true);
  const [covertSosSent, setCovertSosSent] = useState(false);

  const handleDigit = (digit) => {
    if (isNewNumber) {
      setDisplay(digit);
      setIsNewNumber(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  };

  const handleOperator = (op) => {
    setPreviousValue(parseFloat(display));
    setOperator(op);
    setIsNewNumber(true);
  };

  const handleClear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperator(null);
    setIsNewNumber(true);
  };

  const triggerCovertAlert = async () => {
    if (activeTrip) {
      try {
        await api.triggerSilentDistress(activeTrip.id);
        setCovertSosSent(true);
        // Discrete haptic/micro-feedback without raising suspicion
        setTimeout(() => setCovertSosSent(false), 4000);
      } catch (e) {
        console.error('Distress dispatch failed', e);
      }
    }
  };

  const handleEquals = () => {
    // Secret trigger: entering 911= or 999= triggers Covert SOS!
    if (display === '911' || display === '999') {
      triggerCovertAlert();
      setDisplay('Error: 911');
      return;
    }

    if (!operator || previousValue === null) return;
    const current = parseFloat(display);
    let result = 0;
    switch (operator) {
      case '+': result = previousValue + current; break;
      case '-': result = previousValue - current; break;
      case '×': result = previousValue * current; break;
      case '÷': result = current !== 0 ? previousValue / current : 0; break;
      default: return;
    }
    setDisplay(String(Math.round(result * 100000) / 100000));
    setPreviousValue(null);
    setOperator(null);
    setIsNewNumber(true);
  };

  return (
    <div className="max-w-sm mx-auto p-4 w-full flex flex-col items-center justify-center min-h-[600px]">
      <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-4">
        {/* Top covert bar */}
        <div className="flex items-center justify-between text-slate-500 text-xs pb-2 border-b border-slate-800">
          <button onClick={onClose} className="flex items-center gap-1 hover:text-slate-300">
            <ArrowLeft className="w-4 h-4" /> <span>Back</span>
          </button>
          <span className="font-mono text-[11px] text-slate-600">Standard Calculator</span>
          {/* Covert dot indicator showing alert was delivered */}
          <div className="w-2.5 h-2.5 rounded-full bg-slate-800 flex items-center justify-center">
            {covertSosSent && <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>}
          </div>
        </div>

        {/* Calculator Display */}
        <div className="bg-slate-950 rounded-2xl p-4 text-right border border-slate-800/80">
          <div className="text-slate-500 text-xs h-4 font-mono">
            {previousValue !== null && `${previousValue} ${operator}`}
          </div>
          <div className="text-4xl font-mono font-bold text-slate-100 tracking-tight overflow-x-auto">
            {display}
          </div>
        </div>

        {/* Discrete Covert Guide for the Hitchhiker */}
        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Distress Code: Enter <strong className="text-amber-400">911</strong> then tap <strong className="text-amber-400">=</strong></span>
          <button
            onClick={triggerCovertAlert}
            className="text-[10px] bg-rose-950 text-rose-300 border border-rose-800 px-2 py-0.5 rounded font-semibold hover:bg-rose-900"
          >
            Silent SOS
          </button>
        </div>

        {/* Calculator Keypad */}
        <div className="grid grid-cols-4 gap-2.5">
          <button onClick={handleClear} className="bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold p-3.5 rounded-2xl text-lg transition">AC</button>
          <button onClick={() => setDisplay(String(-parseFloat(display)))} className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold p-3.5 rounded-2xl text-lg transition">±</button>
          <button onClick={() => setDisplay(String(parseFloat(display) / 100))} className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold p-3.5 rounded-2xl text-lg transition">%</button>
          <button onClick={() => handleOperator('÷')} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold p-3.5 rounded-2xl text-lg transition">÷</button>

          <button onClick={() => handleDigit('7')} className="bg-slate-800/60 hover:bg-slate-700 text-slate-100 font-semibold p-3.5 rounded-2xl text-lg transition">7</button>
          <button onClick={() => handleDigit('8')} className="bg-slate-800/60 hover:bg-slate-700 text-slate-100 font-semibold p-3.5 rounded-2xl text-lg transition">8</button>
          <button onClick={() => handleDigit('9')} className="bg-slate-800/60 hover:bg-slate-700 text-slate-100 font-semibold p-3.5 rounded-2xl text-lg transition">9</button>
          <button onClick={() => handleOperator('×')} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold p-3.5 rounded-2xl text-lg transition">×</button>

          <button onClick={() => handleDigit('4')} className="bg-slate-800/60 hover:bg-slate-700 text-slate-100 font-semibold p-3.5 rounded-2xl text-lg transition">4</button>
          <button onClick={() => handleDigit('5')} className="bg-slate-800/60 hover:bg-slate-700 text-slate-100 font-semibold p-3.5 rounded-2xl text-lg transition">5</button>
          <button onClick={() => handleDigit('6')} className="bg-slate-800/60 hover:bg-slate-700 text-slate-100 font-semibold p-3.5 rounded-2xl text-lg transition">6</button>
          <button onClick={() => handleOperator('-')} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold p-3.5 rounded-2xl text-lg transition">-</button>

          <button onClick={() => handleDigit('1')} className="bg-slate-800/60 hover:bg-slate-700 text-slate-100 font-semibold p-3.5 rounded-2xl text-lg transition">1</button>
          <button onClick={() => handleDigit('2')} className="bg-slate-800/60 hover:bg-slate-700 text-slate-100 font-semibold p-3.5 rounded-2xl text-lg transition">2</button>
          <button onClick={() => handleDigit('3')} className="bg-slate-800/60 hover:bg-slate-700 text-slate-100 font-semibold p-3.5 rounded-2xl text-lg transition">3</button>
          <button onClick={() => handleOperator('+')} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold p-3.5 rounded-2xl text-lg transition">+</button>

          <button onClick={() => handleDigit('0')} className="col-span-2 bg-slate-800/60 hover:bg-slate-700 text-slate-100 font-semibold p-3.5 rounded-2xl text-lg transition">0</button>
          <button onClick={() => !display.includes('.') && setDisplay(display + '.')} className="bg-slate-800/60 hover:bg-slate-700 text-slate-100 font-semibold p-3.5 rounded-2xl text-lg transition">.</button>
          <button onClick={handleEquals} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold p-3.5 rounded-2xl text-lg transition">=</button>
        </div>
      </div>
    </div>
  );
}
