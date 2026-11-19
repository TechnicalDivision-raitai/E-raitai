import React, { useState, useRef, useEffect, useId } from 'react';

interface AutoSuggestInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  getItemHint?: (item: string) => string | undefined;
  placeholder?: string;
  className?: string;
  minCharsToSuggest?: number;
}

/**
 * Standard single-line clean autocomplete input.
 * - Shows suggestions when user types (value.trim().length >= minCharsToSuggest) or presses ArrowDown/ArrowUp.
 * - Supports full keyboard navigation (ArrowDown, ArrowUp, Enter, Escape, Tab) and mouse selection.
 * - Filters suggestions that match the typed text (case-insensitive & whitespace-normalized).
 * - Renders a single-line clean dropdown with no duplicated lines or browser datalist glitches.
 */
export const AutoSuggestInput: React.FC<AutoSuggestInputProps> = ({
  value,
  onChange,
  suggestions = [],
  getItemHint,
  placeholder = '',
  className = '',
  minCharsToSuggest = 1,
  onKeyDown,
  onFocus,
  ...restProps
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [forceShowAll, setForceShowAll] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const listboxId = useId();

  // Normalize text for comparison: collapse multiple spaces and trim
  const cleanInput = (value || '').replace(/\s+/g, ' ').trim().toLowerCase();

  // Compute dropdown suggestions:
  // - While typing: show up to 20 matching items (excluding exact match)
  // - When explicitly opened via ArrowDown/ArrowUp: show matching items or fallback to other available suggestions
  const filteredSuggestions = React.useMemo(() => {
    if (!forceShowAll && (!cleanInput || cleanInput.length < minCharsToSuggest)) {
      return [];
    }

    if (!cleanInput) {
      return suggestions.slice(0, 25);
    }

    const partialMatches = suggestions.filter(item => {
      const cleanItem = item.replace(/\s+/g, ' ').trim().toLowerCase();
      return cleanItem.includes(cleanInput) && cleanItem !== cleanInput;
    });

    if (partialMatches.length > 0) {
      return partialMatches.slice(0, 20);
    }

    if (forceShowAll) {
      return suggestions
        .filter(item => item.replace(/\s+/g, ' ').trim().toLowerCase() !== cleanInput)
        .slice(0, 25);
    }

    return [];
  }, [cleanInput, suggestions, minCharsToSuggest, forceShowAll]);

  // Reset highlighted index when typed query changes
  useEffect(() => {
    setActiveIndex(-1);
  }, [cleanInput]);

  // Keep active index within bounds if suggestions shrink
  useEffect(() => {
    if (activeIndex >= filteredSuggestions.length) {
      setActiveIndex(filteredSuggestions.length > 0 ? filteredSuggestions.length - 1 : -1);
    }
  }, [filteredSuggestions.length, activeIndex]);

  // Scroll highlighted option into view when navigating with keyboard
  useEffect(() => {
    if (isOpen && activeIndex >= 0) {
      const activeEl = itemRefs.current[activeIndex];
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex, isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setForceShowAll(false);
        setActiveIndex(-1);
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
    setForceShowAll(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      if (!isOpen) {
        if (filteredSuggestions.length > 0) {
          e.preventDefault();
          setIsOpen(true);
          setActiveIndex(0);
          return;
        }
        if (suggestions.length > 0) {
          e.preventDefault();
          setForceShowAll(true);
          setIsOpen(true);
          setActiveIndex(0);
          return;
        }
      } else if (filteredSuggestions.length > 0) {
        e.preventDefault();
        setActiveIndex(prev => (prev < filteredSuggestions.length - 1 ? prev + 1 : 0));
        return;
      }
    } else if (e.key === 'ArrowUp') {
      if (isOpen && filteredSuggestions.length > 0) {
        e.preventDefault();
        setActiveIndex(prev => (prev > 0 ? prev - 1 : filteredSuggestions.length - 1));
        return;
      }
      if (!isOpen && suggestions.length > 0) {
        e.preventDefault();
        const fallbackCount =
          filteredSuggestions.length > 0
            ? filteredSuggestions.length
            : suggestions
                .filter(item => item.replace(/\s+/g, ' ').trim().toLowerCase() !== cleanInput)
                .slice(0, 25).length;
        if (fallbackCount > 0) {
          setForceShowAll(true);
          setIsOpen(true);
          setActiveIndex(fallbackCount - 1);
          return;
        }
      }
    } else if (e.key === 'Enter') {
      if (isOpen && activeIndex >= 0 && activeIndex < filteredSuggestions.length) {
        e.preventDefault();
        handleSelect(filteredSuggestions[activeIndex]);
        return;
      }
    } else if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        setIsOpen(false);
        setForceShowAll(false);
        setActiveIndex(-1);
        return;
      }
    } else if (e.key === 'Tab') {
      if (isOpen) {
        setIsOpen(false);
        setForceShowAll(false);
        setActiveIndex(-1);
      }
    }

    onKeyDown?.(e);
  };

  const showDropdown = isOpen && filteredSuggestions.length > 0;

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        aria-controls={showDropdown ? listboxId : undefined}
        aria-activedescendant={
          showDropdown && activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
        }
        value={value}
        onChange={e => {
          onChange(e.target.value);
          setForceShowAll(false);
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={e => {
          if (filteredSuggestions.length > 0) {
            setIsOpen(true);
          }
          onFocus?.(e);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        {...restProps}
      />

      {showDropdown && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100 text-xs py-1 animate-in fade-in-50 duration-100"
        >
          {filteredSuggestions.map((item, index) => {
            const hint = getItemHint ? getItemHint(item) : undefined;
            const isActive = index === activeIndex;
            return (
              <li
                key={`${item}-${index}`}
                id={`${listboxId}-opt-${index}`}
                role="option"
                aria-selected={isActive}
                ref={el => {
                  itemRefs.current[index] = el;
                }}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={e => {
                  // onMouseDown fires before onBlur
                  e.preventDefault();
                  handleSelect(item);
                }}
                className={`px-3 py-2 cursor-pointer transition flex items-center justify-between whitespace-nowrap overflow-hidden text-ellipsis ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-900 font-semibold'
                    : 'text-slate-700 hover:bg-emerald-50/70 hover:text-emerald-900'
                }`}
              >
                <span className="font-medium truncate">{item}</span>
                <span
                  className={`text-[10px] shrink-0 ml-2 truncate max-w-[180px] ${
                    isActive ? 'text-emerald-700 font-medium' : 'text-slate-400'
                  }`}
                >
                  {hint || (isActive ? 'กด Enter เพื่อเลือก' : 'เลือก')}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
