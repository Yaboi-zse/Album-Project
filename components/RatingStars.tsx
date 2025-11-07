import { useState } from 'react';

interface RatingStarsProps {
  initialValue?: number;
  max?: number;
  editable?: boolean;
  onChange?: (value: number) => void;
}

export default function RatingStars({
  initialValue = 0,
  max = 10,
  editable = false,
  onChange,
}: RatingStarsProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const [rating, setRating] = useState<number>(initialValue);

  const handleClick = (value: number) => {
    if (!editable) return;
    setRating(value);
    onChange?.(value);
  };

  return (
    <div style={{ display: 'flex', gap: 4, cursor: editable ? 'pointer' : 'default' }}>
      {[...Array(max)].map((_, i) => {
        const value = i + 1;
        const filled = hoverValue
          ? value <= hoverValue
          : value <= rating;
        return (
          <span
            key={i}
            style={{
              color: filled ? '#facc15' : '#d1d5db',
              fontSize: 22,
              transition: 'color 0.15s ease-in-out',
            }}
            onMouseEnter={() => editable && setHoverValue(value)}
            onMouseLeave={() => editable && setHoverValue(null)}
            onClick={() => handleClick(value)}
          >
            ★
          </span>
        );
      })}
    </div>
  );
}
