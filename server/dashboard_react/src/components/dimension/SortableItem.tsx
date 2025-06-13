import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Lock, Trash2 } from 'lucide-react';

interface SortableItemProps {
  id: string;
  dimension: {
    dimension: string;
    position: number;
    description: string;
  };
  onDelete: (dimensionName: string) => void;
}

export function SortableItem({ id, dimension, onDelete }: SortableItemProps) {
  const isVariantIds = dimension.dimension === 'variantIds';

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id,
    disabled: isVariantIds
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : 1,
  };

  const handleDelete = () => {
    if (!isVariantIds) {
      onDelete(dimension.dimension);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white/5 border rounded-xl p-4 flex items-center justify-between group transition-all duration-200 ${
        isDragging 
          ? 'border-purple-400/50 shadow-lg shadow-purple-500/10 bg-white/10' 
          : isVariantIds
            ? 'border-blue-400/30 bg-blue-500/10'
            : 'border-white/10 hover:bg-white/10'
      }`}
    >
      <div className="flex items-center space-x-4">
        {isVariantIds ? (
          <div className="text-blue-400">
            <Lock size={20} />
          </div>
        ) : (
          <button
            {...attributes}
            {...listeners}
            className="text-white/40 hover:text-white/60 cursor-grab active:cursor-grabbing"
          >
            <GripVertical size={20} />
          </button>
        )}
        <div>
          <h3 className="text-white font-medium">
            {dimension.dimension}
          </h3>
          <p className="text-white/60 text-sm">
            Position: {dimension.position}
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <p className="text-white/40 text-sm">
          {isVariantIds ? "System dimension - cannot be deleted" : dimension.description}
        </p>
        {!isVariantIds && (
          <button
            onClick={handleDelete}
            className="text-red-400 hover:text-red-300 transition-colors duration-200 p-1.5 hover:bg-red-400/10 rounded-lg"
            title="Delete dimension"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>
    </div>
  );
};