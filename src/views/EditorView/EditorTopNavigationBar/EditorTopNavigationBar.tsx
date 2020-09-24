import {ContextType} from "../../../data/enums/ContextType";
import './EditorTopNavigationBar.scss';
import React from "react";
import classNames from "classnames";
import {AppState} from "../../../store";
import {connect} from "react-redux";
import {updateCrossHairVisibleStatus, updateImageDragModeStatus} from "../../../store/general/actionCreators";
import {GeneralSelector} from "../../../store/selectors/GeneralSelector";
import {ViewPointSettings} from "../../../settings/ViewPointSettings";
import {ImageButton} from "../../Common/ImageButton/ImageButton";
import {TextButton} from "../../Common/TextButton/TextButton"
import {ViewPortActions} from "../../../logic/actions/ViewPortActions";
import {LabelsSelector} from "../../../store/selectors/LabelsSelector";
import {LabelType} from "../../../data/enums/LabelType";
import {AISelector} from "../../../store/selectors/AISelector";
import {ISize} from "../../../interfaces/ISize";
import {AIActions} from "../../../logic/actions/AIActions";
import {BuildingMetadata} from "../../../store/labels/types";
import {BuildingMetadataUtil} from "../../../utils/BuildingMetadataUtil"
import {updateAssociations, deleteAssociation} from "../../../store/labels/actionCreators";
import {store} from "../../../index";

interface IProps {
    activeContext: ContextType;
    updateImageDragModeStatus: (imageDragMode: boolean) => any;
    updateCrossHairVisibleStatus: (crossHairVisible: boolean) => any;
    imageDragMode: boolean;
    crossHairVisible: boolean;
    activeLabelType: LabelType;
    activeLabelId: string;
    buildingMetadata: BuildingMetadata;
}

const EditorTopNavigationBar: React.FC<IProps> = (
    {
        activeContext,
        updateImageDragModeStatus,
        updateCrossHairVisibleStatus,
        imageDragMode,
        crossHairVisible,
        activeLabelType,
        activeLabelId,
        buildingMetadata
    }) => {
    const buttonSize: ISize = {width: 30, height: 30};
    const buttonPadding: number = 10;

    const getClassName = () => {
        return classNames(
            "EditorTopNavigationBar",
            {
                "with-context": activeContext === ContextType.EDITOR
            }
        );
    };

    const imageDragOnClick = () => {
        if (imageDragMode) {
            updateImageDragModeStatus(!imageDragMode);
        }
        else if (GeneralSelector.getZoom() !== ViewPointSettings.MIN_ZOOM) {
            updateImageDragModeStatus(!imageDragMode);
        }
    };

    const crossHairOnClick = () => {
        updateCrossHairVisibleStatus(!crossHairVisible);
    }

    const activeFacadeAssociated = () => {
      if (activeLabelId !== null && BuildingMetadataUtil.alreadyAssociated(activeLabelId))
      	return true;
      else
        return false;
    }

    const activeFacadeAssociatable = () => {
      if (activeLabelId !== null) {
      	if (BuildingMetadataUtil.alreadyAssociated(activeLabelId))
      	  return false;
	else {
	  if (BuildingMetadataUtil.availableForAssociation())
	    return true;
	  else
	    return false;
	}
      }
      else
        return false;
    }

    return (
        <div className={getClassName()}>
            <div className="ButtonWrapper">
                <ImageButton
                    image={"ico/zoom-in.png"}
                    imageAlt={"zoom-in"}
                    buttonSize={buttonSize}
                    padding={buttonPadding}
                    onClick={() => ViewPortActions.zoomIn()}
                />
                <ImageButton
                    image={"ico/zoom-out.png"}
                    imageAlt={"zoom-out"}
                    buttonSize={buttonSize}
                    padding={buttonPadding}
                    onClick={() => ViewPortActions.zoomOut()}
                />
                <ImageButton
                    image={"ico/zoom-fit.png"}
                    imageAlt={"zoom-fit"}
                    buttonSize={buttonSize}
                    padding={buttonPadding}
                    onClick={() => ViewPortActions.setDefaultZoom()}
                />
                <ImageButton
                    image={"ico/zoom-max.png"}
                    imageAlt={"zoom-max"}
                    buttonSize={buttonSize}
                    padding={buttonPadding}
                    onClick={() => ViewPortActions.setOneForOneZoom()}
                />
            </div>
            <div className="ButtonWrapper">
                <ImageButton
                    image={"ico/hand.png"}
                    imageAlt={"hand"}
                    buttonSize={buttonSize}
                    padding={buttonPadding}
                    onClick={imageDragOnClick}
                    isActive={imageDragMode}
                />
                <ImageButton
                    image={"ico/cross-hair.png"}
                    imageAlt={"cross-hair"}
                    buttonSize={buttonSize}
                    padding={buttonPadding}
                    onClick={crossHairOnClick}
                    isActive={crossHairVisible}
                />
            </div>
            {((activeLabelType === LabelType.RECTANGLE && AISelector.isAIObjectDetectorModelLoaded()) ||
                (activeLabelType === LabelType.POINT && AISelector.isAIPoseDetectorModelLoaded())) && <div className="ButtonWrapper">
                <ImageButton
                    image={"ico/accept-all.png"}
                    imageAlt={"accept-all"}
                    buttonSize={buttonSize}
                    padding={buttonPadding}
                    onClick={() => {
                        console.log("click");
                        AIActions.acceptAllSuggestedLabels(LabelsSelector.getActiveImageData())
                    }}
                />
                <ImageButton
                    image={"ico/reject-all.png"}
                    imageAlt={"reject-all"}
                    buttonSize={buttonSize}
                    padding={buttonPadding}
                    onClick={() => AIActions.rejectAllSuggestedLabels(LabelsSelector.getActiveImageData())}
                />
            </div>}
	    <div className="ButtonWrapper">
	       <div className="Association">Association:</div>
                   <TextButton
                        label={"Add"}
                        onClick={() => {activeFacadeAssociatable() && store.dispatch(updateAssociations(activeLabelId));} }
			isDisabled={!activeFacadeAssociatable()}
                    />
                   <TextButton
                        label={"Delete"}
                        onClick={() => {activeFacadeAssociated() && store.dispatch(deleteAssociation(activeLabelId));}}
			isDisabled={!activeFacadeAssociated()}
                   />
	    </div>
        </div>
    )
};

const mapDispatchToProps = {
    updateImageDragModeStatus,
    updateCrossHairVisibleStatus
};

const mapStateToProps = (state: AppState) => ({
    activeContext: state.general.activeContext,
    imageDragMode: state.general.imageDragMode,
    crossHairVisible: state.general.crossHairVisible,
    activeLabelType: state.labels.activeLabelType,
    buildingMetadata: state.labels.buildingMetadata,
    activeLabelId: state.labels.activeLabelId
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(EditorTopNavigationBar);
