import React, {useState} from 'react'
import './EditImageMetadataPopup.scss'
import {GenericYesNoPopup} from "../GenericYesNoPopup/GenericYesNoPopup";
import {PopupWindowType} from "../../../data/enums/PopupWindowType";
import {updateLabelNames} from "../../../store/labels/actionCreators";
import {updateActivePopupType} from "../../../store/general/actionCreators";
import {AppState} from "../../../store";
import {connect} from "react-redux";
import Scrollbars from 'react-custom-scrollbars';
import TextInput from "../../Common/TextInput/TextInput";
import {ImageButton} from "../../Common/ImageButton/ImageButton";
import uuidv1 from 'uuid/v1';
import {LabelName} from "../../../store/labels/types";
import {LabelUtil} from "../../../utils/LabelUtil";
import {LabelsSelector} from "../../../store/selectors/LabelsSelector";
import {LabelActions} from "../../../logic/actions/LabelActions";

interface IProps {
    updateActivePopupType: (activePopupType: PopupWindowType) => any;
    updateLabelNames: (labels: LabelName[]) => any;
}

const EditImageMetadataPopup: React.FC<IProps> = ({updateActivePopupType, updateLabelNames}) => {
    const [imageMetadata, setImageMetadata] = useState({
    	"reference link": "",
	"street address": "",
	"latitude": "",
	"longitude": "",
	"other info": ""
    });

    const imageMetadataInputs = Object.keys(imageMetadata).map((key: string) => {
        return <div className="LabelEntry" key={key}>
                <TextInput
                    key={key}
                    value={imageMetadata[key]}
                    isPassword={false}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(key, event.target.value)}
                    label={key}
                />
            </div>
    });

    const onChange = (key: string, value: string) => {
        const newImageMetadata = {...imageMetadata, [key]: value};
        setImageMetadata(newImageMetadata);
    };

    const onUpdateAccept = () => {
    	updateActivePopupType(null);
    };

    const onUpdateReject = () => {
        updateActivePopupType(null);
    };

    const renderContent = () => {
        return(<div className="InsertLabelNamesPopup">
            <div className="RightContainer">
                <div className="Message">
		You can now edit the metadata of the image just added.
                </div>
                <div className="LabelsContainer">
                    <Scrollbars>
                        <div
                            className="InsertLabelNamesPopupContent"
                        >
                            {imageMetadataInputs}
                        </div>
                    </Scrollbars>
                </div>
            </div>
        </div>);
    };

    return(
        <GenericYesNoPopup
            title={"Edit image metadata"}
            renderContent={renderContent}
            acceptLabel={"Accept"}
            onAccept={onUpdateAccept}
            rejectLabel={"Cancel"}
            onReject={onUpdateReject}
        />)
};

const mapDispatchToProps = {
    updateActivePopupType,
    updateLabelNames
};

const mapStateToProps = (state: AppState) => ({});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(EditImageMetadataPopup);
