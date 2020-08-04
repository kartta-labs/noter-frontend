import {LabelsActionTypes, LabelsState, ImageData, FacadeFrontLinePair} from "./types";
import {Action} from "../Actions";

const initialState: LabelsState = {
    activeImageIndex: null,
    activeLabelNameId: "facade",
    activeLabelType: null,
    activeLabelId: null,
    highlightedLabelId: null,
    imagesData: [],
    firstLabelCreatedFlag: false,
    labels: [{name: "facade", id: "facade"}],
    buildingMetadata: {footprint: [{vertices : [{ x: 20, y: 20, isSelected: false, facadeId: null}, { x: 140, y: 20, isSelected: false, facadeId: null}, { x: 140, y: 60, isSelected: false, facadeId: null}, { x: 20, y: 60, isSelected: false, facadeId: null}]}], associations: []},
};

export function labelsReducer(
    state = initialState,
    action: LabelsActionTypes
): LabelsState {
    switch (action.type) {
        case Action.UPDATE_ACTIVE_IMAGE_INDEX: {
            return {
                ...state,
                activeImageIndex: action.payload.activeImageIndex
            }
        }
        case Action.UPDATE_ACTIVE_LABEL_NAME_ID: {
            return {
                ...state,
                activeLabelNameId: action.payload.activeLabelNameId
            }
        }
        case Action.UPDATE_ACTIVE_LABEL_ID: {
            return {
                ...state,
                activeLabelId: action.payload.activeLabelId
            }
        }
        case Action.UPDATE_HIGHLIGHTED_LABEL_ID: {
            return {
                ...state,
                highlightedLabelId: action.payload.highlightedLabelId
            }
        }
        case Action.UPDATE_ACTIVE_LABEL_TYPE: {
            return {
                ...state,
                activeLabelType: action.payload.activeLabelType
            }
        }
        case Action.UPDATE_IMAGE_DATA_BY_ID: {
            return {
                ...state,
                imagesData: state.imagesData.map((imageData: ImageData) =>
                    imageData.id === action.payload.id ? action.payload.newImageData : imageData
                )
            }
        }
        case Action.ADD_IMAGES_DATA: {
            return {
                ...state,
                imagesData: state.imagesData.concat(action.payload.imageData)
            }
        }
        case Action.UPDATE_IMAGES_DATA: {
            return {
                ...state,
                imagesData: action.payload.imageData
            }
        }
        case Action.UPDATE_LABEL_NAMES: {
            return {
                ...state,
                labels: action.payload.labels
            }
        }
        case Action.UPDATE_FIRST_LABEL_CREATED_FLAG: {
            return {
                ...state,
                firstLabelCreatedFlag: action.payload.firstLabelCreatedFlag
            }
        }
        case Action.UPDATE_FOOTPRINT: {
            return {
                ...state,
                buildingMetadata: {
                    ...state.buildingMetadata,
                    footprint: action.payload.footprint
                }
            }
        }
        case Action.UPDATE_SELECTED_POINTS: {
            let current_point =
                state.buildingMetadata.footprint[action.payload.polygonIndex].vertices[action.payload.pointIndex];
            let newState = JSON.parse(JSON.stringify(state));
            newState.buildingMetadata.footprint[action.payload.polygonIndex].vertices[action.payload.pointIndex].isSelected =
                !current_point.isSelected;
            return newState;
        }
        case Action.UPDATE_ASSOCIATIONS: {
            let newState = JSON.parse(JSON.stringify(state));
            const facadeFrontLinePair: FacadeFrontLinePair = {facadeId: "", polygonIndex: 0, indices: []};
            for (let i = 0; i < newState.buildingMetadata.footprint.length; ++i) {
                for (let j = 0; j < newState.buildingMetadata.footprint[i].vertices.length; ++j) {
                    if (newState.buildingMetadata.footprint[i].vertices[j].isSelected) {
                        newState.buildingMetadata.footprint[i].vertices[j].isSelected = false;
                        facadeFrontLinePair.polygonIndex = i;
                        facadeFrontLinePair.indices.push(j);
                    }
                }
            }
            facadeFrontLinePair.facadeId =  action.payload.facadeId;
            newState.buildingMetadata.associations.push(facadeFrontLinePair);
            return newState;
        }
        case Action.DELETE_ASSOCIATION: {
            let newState = JSON.parse(JSON.stringify(state));
            for (let i = 0; i < newState.buildingMetadata.associations.length; ++i) {
                if (newState.buildingMetadata.associations[i].facadeId === action.payload.facadeId) {
                    newState.buildingMetadata.associations.splice(i, 1);
                    console.log("delete the association!!!");
                    return newState;
                }
            }
            return newState;
        }
        default:
            return state;
    }
}
