import React from 'react';
import './Checkbox.scss';

interface IProps {
    handleCheckboxChange: any;
    label: string;
}

interface IState {
    isChecked: boolean;
}

export class Checkbox extends React.Component<IProps, IState> {

  constructor(props) {
    super(props);

    this.state = {
      isChecked: true,
    }
  }

  toggleCheckboxChange = () => {
    const { handleCheckboxChange, label } = this.props;

    this.setState(({ isChecked }) => (
      {
        isChecked: !isChecked,
      }
    ));

    handleCheckboxChange(this.state);
  }

  render() {
    const { label } = this.props;
    const { isChecked } = this.state;

    return (
      <div className="Checkbox">
          <input
            type="checkbox"
            value={label}
            checked={isChecked}
            onChange={this.toggleCheckboxChange}
          />
          {label}
      </div>
    );
  }
}
