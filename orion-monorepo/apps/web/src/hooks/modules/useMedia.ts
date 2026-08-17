import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  MediaHub,
  MediaItem,
  MediaItemInput,
  MediaRecommendation,
  MediaRecommendationInput,
} from "@orion/types";
import { api } from "../../lib/api.js";

export function useMediaHub() {
  return useQuery<MediaHub>({
    queryKey: ["media", "hub"],
    queryFn: api.media.hub,
  });
}

export function useCreateMediaItem() {
  const qc = useQueryClient();
  return useMutation<MediaItem, Error, MediaItemInput>({
    mutationFn: api.media.createItem,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["media"] }),
  });
}

export function useUpdateMediaItem() {
  const qc = useQueryClient();
  return useMutation<MediaItem, Error, { id: string; input: Partial<MediaItemInput> }>({
    mutationFn: ({ id, input }) => api.media.updateItem(id, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["media"] }),
  });
}

export function useRemoveMediaItem() {
  const qc = useQueryClient();
  return useMutation<{ id: string }, Error, string>({
    mutationFn: api.media.removeItem,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["media"] }),
  });
}

export function useMediaRecommendations() {
  return useMutation<MediaRecommendation[], Error, MediaRecommendationInput>({
    mutationFn: api.media.recommend,
  });
}
