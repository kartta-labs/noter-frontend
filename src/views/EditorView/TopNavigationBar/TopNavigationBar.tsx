import React from 'react';
import './TopNavigationBar.scss';
import StateBar from "../StateBar/StateBar";
import {UnderlineTextButton} from "../../Common/UnderlineTextButton/UnderlineTextButton";
import {PopupWindowType} from "../../../data/enums/PopupWindowType";
import {AppState} from "../../../store";
import {connect} from "react-redux";
import {updateActivePopupType, updateProjectData} from "../../../store/general/actionCreators";
import {ProjectData} from "../../../store/general/types";
import {Uploader} from "../../../logic/export/Uploader";

interface IProps {
    updateActivePopupType: (activePopupType: PopupWindowType) => any;
    updateProjectData: (projectData: ProjectData) => any;
    projectData: ProjectData;
}

const TopNavigationBar: React.FC<IProps> = ({updateActivePopupType, updateProjectData, projectData}) => {
    return (
        <div className="TopNavigationBar">
            <StateBar/>
            <div className="TopNavigationBarWrapper">
                <div>
                    <div
                        className="Header"
                        onClick={() => updateActivePopupType(PopupWindowType.EXIT_PROJECT)}
                    >
                        <img
                            draggable={false}
                            alt={"logo"}
                            src={"logo.png"}
                        />
                        Noter
                    </div>
                </div>
                <div className="NavigationBarGroupWrapper">
                    <UnderlineTextButton
                        label={"Add Image"}
                        under={true}
                        onClick={() => updateActivePopupType(PopupWindowType.LOAD_IMAGES)}
                    />
                    <UnderlineTextButton
                        label={"Save"}
                        under={true}
                        onClick={() => {Uploader.uploadAll()}}
                    />
                </div>
            </div>
        </div>
    );
};

const mapDispatchToProps = {
    updateActivePopupType,
    updateProjectData
};

const mapStateToProps = (state: AppState) => ({
    projectData: state.general.projectData
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(TopNavigationBar);
