import { useState, useEffect, useCallback } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { GripVertical, X } from 'lucide-react';
import axios from '../../api/axios';
import { SortableItem } from './SortableItem';


interface DimensionPriorityProps {
  application: string;
  organization: string;
  onClose: () => void;
}

interface Dimension {
  dimension: string;
  position: number;
  description: string;
}

export default function DimensionPriority({
  application,
  organization,
  onClose,
}: DimensionPriorityProps) {
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingDimension, setDeletingDimension] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchDimensions = useCallback(async () => {
    try {
      const response = await axios.get(
        `/organisations/applications/dimension/list`,
        {
          headers: {
            'x-organisation': organization,
            'x-application': application
          }
        }
      );
      
      const sortedDimensions = response.data.data?.sort(
        (a: Dimension, b: Dimension) => a.position - b.position
      ) || [];

      setDimensions(sortedDimensions);
    } catch (err: any) {
      setError('Failed to load dimensions');
      console.error('Error fetching dimensions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [application, organization]);

  useEffect(() => {
    fetchDimensions();
  }, [fetchDimensions]);

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = dimensions.findIndex((item) => item.dimension === active.id);
      const newIndex = dimensions.findIndex((item) => item.dimension === over.id);
      
      if (newIndex === 0) {
        return;
      }
  
      const newItems = arrayMove(dimensions, oldIndex, newIndex);
      const updatedItems = newItems.map((item, index) => ({
        ...item,
        position: item.dimension === 'variantIds' ? 0 : index
      }));
      
      // Update state first
      setDimensions(updatedItems);
      
      // Then make API call
      await updateDimensionPositions(updatedItems);
    }
  };  

  const updateDimensionPositions = async (updatedDimensions: Dimension[]) => {
    setIsSaving(true);
    setError('');
    
    try {
      await Promise.all(
        updatedDimensions.map((dimension) =>
          axios.put(
            `/organisations/applications/dimension/${dimension.dimension}`,
            {
              position: dimension.position,
              change_reason: 'Updated dimension priority order'
            },
            {
              headers: {
                'x-organisation': organization,
                'x-application': application
              }
            }
          )
        )
      );
    } catch (err) {
      setError('Failed to update dimension priorities');
      console.error('Error updating dimensions:', err);
      // Refresh the list to get the current state
      fetchDimensions();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (dimensionName: string) => {
    if (window.confirm(`Are you sure you want to delete the dimension "${dimensionName}"? This action cannot be undone.`)) {
      setDeletingDimension(dimensionName);
      setError('');
      
      try {
        await axios.delete(
          `/organisations/applications/dimension/${dimensionName}`,
          {
            headers: {
              'x-organisation': organization,
              'x-application': application
            }
          }
        );

        // Remove the deleted dimension from state
        setDimensions(dimensions => dimensions.filter(d => d.dimension !== dimensionName));
      } catch (err) {
        setError('Failed to delete dimension');
        console.error('Error deleting dimension:', err);
      } finally {
        setDeletingDimension(null);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 bg-opacity-95 backdrop-blur-sm overflow-y-auto h-full w-full z-50">
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 bg-opacity-95 backdrop-blur-sm overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-8 w-3/4 max-w-4xl">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl">
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-white/20 p-8">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-pink-500 rounded-xl flex items-center justify-center">
                <GripVertical size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Dimension Priorities</h2>
                <p className="text-white/70">Drag to reorder dimensions</p>
              </div>
              <span className="px-4 py-2 text-sm bg-gradient-to-r from-purple-400/20 to-pink-400/20 text-purple-200 rounded-full border border-purple-300/30">
                {organization}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white/90 transition-colors duration-200"
            >
              <X size={24} />
            </button>
          </div>

          <div className="p-8">
            {error && (
              <div className="bg-red-900/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl mb-6">
                {error}
              </div>
            )}

            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext 
                items={dimensions.map(d => d.dimension)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {dimensions.map((dimension) => (
                    <SortableItem
                      key={dimension.dimension}
                      id={dimension.dimension}
                      dimension={dimension}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {dimensions.length === 0 && (
              <div className="text-center py-8">
                <p className="text-white/60">No dimensions found</p>
              </div>
            )}

            <div className="mt-8 flex justify-between items-center">
              <div>
                {(isSaving || deletingDimension) && (
                  <span className="text-purple-300 text-sm">
                    {deletingDimension ? `Deleting ${deletingDimension}...` : 'Saving changes...'}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="px-6 py-3 text-sm font-medium text-white bg-white/10 rounded-xl hover:bg-white/20 transition-all duration-200"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}