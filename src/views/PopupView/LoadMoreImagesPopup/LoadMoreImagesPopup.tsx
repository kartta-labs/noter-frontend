import React from 'react'
import './LoadMoreImagesPopup.scss'
import {AppState} from "../../../store";
import {connect} from "react-redux";
import {addImageData, updateActiveImageIndex} from "../../../store/labels/actionCreators";
import {updateActivePopupType} from "../../../store/general/actionCreators";
import {GenericYesNoPopup} from "../GenericYesNoPopup/GenericYesNoPopup";
import {PopupWindowType} from "../../../data/enums/PopupWindowType";
import {useDropzone} from "react-dropzone";
import {FileUtil} from "../../../utils/FileUtil";
import {ImageData} from "../../../store/labels/types";
import {AcceptedFileType} from "../../../data/enums/AcceptedFileType";
import {PopupActions} from "../../../logic/actions/PopupActions";

interface IProps {
    updateActiveImageIndex: (activeImageIndex: number) => any;
    addImageData: (imageData: ImageData[]) => any;
    updateActivePopupType: (activePopupType: PopupWindowType) => any;
}

const LoadMoreImagesPopup: React.FC<IProps> = ({updateActiveImageIndex, addImageData, updateActivePopupType}) => {
    const {acceptedFiles, getRootProps, getInputProps} = useDropzone({
        accept: AcceptedFileType.IMAGE
    });

    let isUploadPublic = true;
    const onCheckbox = (selection) => {
    	isUploadPublic = selection;
	console.log(isUploadPublic);
    };
    const onAccept = () => {
        if (acceptedFiles.length > 0) {
	    updateActiveImageIndex(0);
            addImageData(acceptedFiles.map((fileData:File) => FileUtil.mapFileDataToImageData(fileData)));
            PopupActions.close();
	    updateActivePopupType(PopupWindowType.EDIT_IMAGE_METADATA);
        }
    };

    const onReject = () => {
        PopupActions.close();
    };

    const getDropZoneContent = () => {
        if (acceptedFiles.length === 0)
            return <>
                <input {...getInputProps()} />
                <img
                    draggable={false}
                    alt={"upload"}
                    src={"img/box-opened.png"}
                />
                <p className="extraBold">Add new images</p>
                <p>or</p>
                <p className="extraBold">Click here to select them</p>
            </>;
        else if (acceptedFiles.length === 1)
            return <>
                <img
                    draggable={false}
                    alt={"uploaded"}
                    src={"img/box-closed.png"}
                />
                <p className="extraBold">1 new image loaded</p>
            </>;
        else
            return <>
                <img
                    draggable={false}
                    key={1}
                    alt={"uploaded"}
                    src={"img/box-closed.png"}
                />
                <p key={2} className="extraBold">{acceptedFiles.length} new images loaded</p>
            </>;
    };

    const renderContent = () => {
        return(<div className="LoadMoreImagesPopupContent">
            <div {...getRootProps({className: 'DropZone'})}>
                {getDropZoneContent()}
            </div>
        </div>);
    };

    return(
        <GenericYesNoPopup
            title={"Load more images"}
            renderContent={renderContent}
            acceptLabel={"Load"}
            disableAcceptButton={acceptedFiles.length < 1}
            onAccept={onAccept}
            rejectLabel={"Cancel"}
            onReject={onReject}
	    onCheckbox={onCheckbox}
        />
    );
};

const mapDispatchToProps = {
    updateActiveImageIndex,
    addImageData,
    updateActivePopupType
};

const mapStateToProps = (state: AppState) => ({});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(LoadMoreImagesPopup);
