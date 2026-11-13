import React, { useState, useRef, useEffect } from 'react';

interface AutoSuggestInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  minCharsToSuggest?: number;
}

/**
 * Standard single-line clean autocomplete input.
 * - Shows suggestions ONLY after user starts typing (value.trim().length >= minCharsToSuggest).
 * - Filters suggestions that match the typed text (case-insensitive & whitespace-normalized).
 * - Renders a single-line clean dropdown with no duplicated lines or browser datalist glitches.
 * - Allows free typing or clicking a suggestion.
 */
export const AutoSuggestInput: React.FC<AutoSuggestInputProps> = ({
  value,
  onChange,
  suggestions = [],
  placeholder = '',
  className = '',
  minCharsToSuggest = 1,
  ...restProps
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize text for comparison: collapse multiple spaces and trim
  const cleanInput = (value || '').replace(/\s+/g, ' ').trim().toLowerCase();

  // Filter suggestions:
  // 1. Must have typed at least minCharsToSuggest characters
  // 2. Suggestions must contain the typed query
  // 3. Do not show if suggestion is already an exact match
  const filteredSuggestions = React.useMemo(() => {
    if (!cleanInput || cleanInput.length < minCharsToSuggest) {
      return [];
    }

    return suggestions
      .filter(item => {
        const cleanItem = item.replace(/\s+/g, ' ').trim().toLowerCase();
        return cleanItem.includes(cleanInput) && cleanItem !== cleanInput;
      })
      .slice(0, 8); // Limit to top 8 clean single-line results
  }, [cleanInput, suggestions, minCharsToSuggest]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (suggestedText: string) => {
    onChange(suggestedText);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        autoComplete="off"
        value={value}
        onChange={e => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (filteredSuggestions.length > 0) {
            setIsOpen(true);
          }
        }}
        placeholder={placeholder}
        className={className}
        {...restProps}
      />

      {isOpen && filteredSuggestions.length > 0 && (
        <ul className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100 text-xs py-1 animate-in fade-in-50 duration-100">
          {filteredSuggestions.map((item, index) => (
            <li
              key={`${item}-${index}`}
              onMouseDown={e => {
                // onMouseDown fires before onBlur
                e.preventDefault();
                handleSelect(item);
              }}
              className="px-3 py-2 cursor-pointer hover:bg-emerald-50 hover:text-emerald-900 transition flex items-center justify-between text-slate-700 whitespace-nowrap overflow-hidden text-ellipsis"
            >
              <span className="font-medium truncate">{item}</span>
              <span className="text-[10px] text-slate-400 shrink-0 ml-2">เลือก</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
