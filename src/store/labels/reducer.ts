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
    buildingMetadata: {footprint: [], associations: []},
    showAlertMessageFlag: false,
};

export function labelsReducer(
    state = initialState,
    action: LabelsActionTypes
): LabelsState {
    switch (action.type) {
        case Action.UPDATE_ACTIVE_IMAGE_INDEX: {
            const currentActiveImageIndex = state.activeImageIndex;
            let newState = {
                ...state,
                activeImageIndex: action.payload.activeImageIndex
            }
            if (currentActiveImageIndex !== null && currentActiveImageIndex != action.payload.activeImageIndex) {
                newState.imagesData[currentActiveImageIndex].buildingMetadata =
                    JSON.parse(JSON.stringify(newState.buildingMetadata));
            }
            if (newState.imagesData.length > 0) {
                newState.buildingMetadata = JSON.parse(JSON.stringify(
                    newState.imagesData[action.payload.activeImageIndex].buildingMetadata));
            }
            return newState;
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
                activeImageIndex: 0,
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
            let newState = {
                              ...state
                };
            newState.buildingMetadata = JSON.parse(JSON.stringify(state.buildingMetadata));
            newState.buildingMetadata.footprint[action.payload.polygonIndex].vertices[action.payload.pointIndex].isSelected =
                !current_point.isSelected;
            return newState;
        }
        case Action.UPDATE_ASSOCIATIONS: {
            let newState = {
                              ...state
                }
            newState.buildingMetadata = JSON.parse(JSON.stringify(state.buildingMetadata));
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
            let newState = {
                              ...state
                }
            newState.buildingMetadata = JSON.parse(JSON.stringify(state.buildingMetadata));
            for (let i = 0; i < newState.buildingMetadata.associations.length; ++i) {
                if (newState.buildingMetadata.associations[i].facadeId === action.payload.facadeId) {
                    newState.buildingMetadata.associations.splice(i, 1);
                    console.log("delete the association!!!");
                    return newState;
                }
            }
            return newState;
        }
        case Action.UPDATE_SHOW_ALERT_MESSAGE_FLAG: {
            return {
                ...state,
                showAlertMessageFlag: action.payload.showAlertMessageFlag
            }
        }
        default:
            return state;
    }
}
