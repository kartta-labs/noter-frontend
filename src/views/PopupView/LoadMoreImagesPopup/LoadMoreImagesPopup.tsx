import React, {useState} from 'react'
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
import TextInput from "../../Common/TextInput/TextInput";
import axios from 'axios';

interface IProps {
    updateActiveImageIndex: (activeImageIndex: number) => any;
    addImageData: (imageData: ImageData[]) => any;
    updateActivePopupType: (activePopupType: PopupWindowType) => any;
}

const LoadMoreImagesPopup: React.FC<IProps> = ({updateActiveImageIndex, addImageData, updateActivePopupType}) => {
    const {acceptedFiles, getRootProps, getInputProps} = useDropzone({
        accept: AcceptedFileType.IMAGE
    });

    const [imageUrl, setImageUrl] = useState("");
    const [isUploadPublic, setUploadpublic] = useState(true);

    const onCheckbox = (selection) => {
    	setUploadpublic(selection);
	console.log(selection);
    };
    const onAccept = () => {
        if (acceptedFiles.length > 0) {
	    updateActiveImageIndex(0);
            addImageData(acceptedFiles.map((fileData:File) => FileUtil.mapFileDataToImageData(fileData, isUploadPublic)));
            PopupActions.close();
	    updateActivePopupType(PopupWindowType.EDIT_IMAGE_METADATA);
        } else {
	    if (imageUrl.length > 0) {
	    	// send request to fecth correpsonding cloud url for current input url
		const url_items = imageUrl.split("/");
		const imagename = url_items[url_items.length - 1];
                axios.post(process.env.REACT_APP_BACKEND_URL + '/nb/lookup/', { "footprint":
                        JSON.stringify({"properties":{"imagename":imagename}}) })
                  .then(response => {
                      // get all cloud urls for the images with the given name
                      const allUrls = [];
                      const matched_images = response.data.candidates;
                      for (let i = 0; i < matched_images.length; ++i) {
                        for (let j = 0; j < matched_images[i].urls.length; ++j) {
                          allUrls.push(matched_images[i].urls[j].url);
                        }
                      }
		      // if return with good result, create the imageData and update
		      if (allUrls.length > 0) {
		        updateActiveImageIndex(0);
		        addImageData(FileUtil.createImageData(allUrls[0], isUploadPublic));
			PopupActions.close();
			updateActivePopupType(PopupWindowType.EDIT_IMAGE_METADATA);
		      } else {
                        // load this url directly
		        updateActiveImageIndex(0);
		        addImageData(FileUtil.createImageData(imageUrl, isUploadPublic));
			PopupActions.close();
			updateActivePopupType(PopupWindowType.EDIT_IMAGE_METADATA);
		      }
		})
		.catch(error => {
		    //window.alert("Error in uploading this url automatically. Please download to local drive and upload from there!");
                    //console.log(error);
		    //temp fix when the "lookup" has no cloud function to use
		    updateActiveImageIndex(0);
	     	    addImageData(FileUtil.createImageData(imageUrl, isUploadPublic));
		    PopupActions.close();
		    updateActivePopupType(PopupWindowType.EDIT_IMAGE_METADATA);
                })
	    }
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

    const onChange = (value: string) => {
	setImageUrl(value);
    };

    const renderContent = () => {
        return(<div className="LoadMoreImagesPopupContent">
            <div {...getRootProps({className: 'DropZone'})}>
                {getDropZoneContent()}
            </div>
            <div >
                <TextInput
                    key="url"
                    value=""
                    isPassword={false}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
                    label="Or Input Image URL"
                />
            </div>
        </div>);
    };

    return(
        <GenericYesNoPopup
            title={"Load more images"}
            renderContent={renderContent}
            acceptLabel={"Load"}
            disableAcceptButton={acceptedFiles.length < 1 && imageUrl.length < 1}
            onAccept={onAccept}
            rejectLabel={"Cancel"}
            onReject={onReject}
	    skipCheckbox={false}
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
