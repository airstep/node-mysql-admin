import React from 'react'

class AboutPage extends React.Component {

    constructor(props) {
        super(props)

        this.state = {
            selected: -1
        }

        this.isTabActive = this.isTabActive.bind(this)
        this.setTab = this.setTab.bind(this)
    }

    isTabActive(idx) {
        return (this.state.selected == idx) ? "nav-link active" : "nav-link"
    }

    setTab(idx) {
        this.setState({
            selected: idx
        })
    }

    componentDidMount() {
        this.setState({
            selected: this.props.selected
        })
    }

    render() {

        let self = this

        return (
            <div>
                <ul className="nav nav-tabs">

                    {
                        self.props.children.map(function (tab, idx) {
                            return (
                                <li className="nav-item pointer" key={idx}>
                                    <a className={self.isTabActive(idx)} onClick={() => self.setTab(idx)}>
                                        {tab.props.label}
                                    </a>
                                </li>
                            )
                        })
                    }

                </ul>

                <div style={{marginTop: 5}}>
                    {self.props.children[self.state.selected]}
                </div>

            </div>
        )
    }

}

export default AboutPage