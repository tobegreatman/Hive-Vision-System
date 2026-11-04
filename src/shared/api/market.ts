import {
  API_ROUTES,
  listMarketBoardsResponseSchema,
  listMarketNodesResponseSchema,
  marketNodeDetailResponseSchema,
  marketNodeResponseSchema,
  marketOverviewResponseSchema,
} from '@platform/contracts'
import type {
  CreateMarketNodePayload,
  ListMarketBoardsResponse,
  ListMarketNodesResponse,
  MarketNodeDetailResponse,
  MarketNodeResponse,
  MarketOverviewResponse,
  UpdateMarketNodePayload,
} from '@platform/contracts'

import { apiRequest } from './client'

export function fetchMarketNodes(signal?: AbortSignal): Promise<ListMarketNodesResponse> {
  return apiRequest(API_ROUTES.nodes, listMarketNodesResponseSchema, signal ? { signal } : {})
}

export function fetchMarketBoards(signal?: AbortSignal): Promise<ListMarketBoardsResponse> {
  return apiRequest(API_ROUTES.boards, listMarketBoardsResponseSchema, signal ? { signal } : {})
}

export function fetchMarketOverview(signal?: AbortSignal): Promise<MarketOverviewResponse> {
  return apiRequest(API_ROUTES.overview, marketOverviewResponseSchema, signal ? { signal } : {})
}

export function createMarketNode(payload: CreateMarketNodePayload): Promise<MarketNodeResponse> {
  return apiRequest(API_ROUTES.nodes, marketNodeResponseSchema, {
    method: 'POST',
    body: payload,
  })
}

export function updateMarketNode(
  id: string,
  payload: UpdateMarketNodePayload,
): Promise<MarketNodeResponse> {
  return apiRequest(API_ROUTES.node(id), marketNodeResponseSchema, {
    method: 'PATCH',
    body: payload,
  })
}

export function fetchMarketNodeDetail(id: string): Promise<MarketNodeDetailResponse> {
  return apiRequest(API_ROUTES.nodeDetail(id), marketNodeDetailResponseSchema)
}
