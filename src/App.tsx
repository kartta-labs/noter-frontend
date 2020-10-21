import React from 'react';
import './App.scss';
import EditorView from "./views/EditorView/EditorView";
import {ProjectType} from "./data/enums/ProjectType";
import {AppState} from "./store";
import {connect} from "react-redux";
import PopupView from "./views/PopupView/PopupView";
import {ISize} from "./interfaces/ISize";
import classNames from "classnames";

interface IProps {
    projectType: ProjectType;
    windowSize: ISize;
    ObjectDetectorLoaded: boolean;
    PoseDetectionLoaded: boolean;
}

const App: React.FC<IProps> = ({projectType, windowSize, ObjectDetectorLoaded, PoseDetectionLoaded}) => {
      return (
        <div className={classNames("App", {"AI": ObjectDetectorLoaded || PoseDetectionLoaded})}
            draggable={false}
        >
            <EditorView/>
	    <PopupView/>
        </div>
      );
};

const mapStateToProps = (state: AppState) => ({
    projectType: state.general.projectData.type,
    windowSize: state.general.windowSize,
    ObjectDetectorLoaded: state.ai.isObjectDetectorLoaded,
    PoseDetectionLoaded: state.ai.isPoseDetectorLoaded
});

export default connect(
    mapStateToProps
)(App);
