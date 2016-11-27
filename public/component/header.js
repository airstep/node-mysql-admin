import m from 'mithril'
import Component from './component'
import pubsub from '../service/pubsub'

const HIDE_ERROR_AFTER_SECONDS = 10

export default class Header extends Component {

    init() {
        var self = this
        self.selectedDbname = m.route.param().dbname
        self.selectedTablename = m.route.param().tablename
        
        self.error = null
        self.showErrorAlertState = "hide"
        self.showLoadingState = "hide"


        /* error listeners */
        pubsub.on("error:show", function (error) {
            self.showError(error)

            setTimeout(self.hideError.bind(self), 1000 * HIDE_ERROR_AFTER_SECONDS)
        })

        pubsub.on("error:hide", function () {
            self.hideError()
        })

        /* loading listeners */
        pubsub.on("loading:show", function () {
            self.showLoading()
        })

        pubsub.on("loading:hide", function () {
            self.hideLoading()
        })

    }

    hideError() {
        this.showErrorAlertState = "hide"
        this.error = ""
    }

    showError(error) {
        this.error = error
        this.showErrorAlertState = ""
    }

    hideLoading() {
        this.showLoadingState = "hide"
    }

    showLoading() {
        this.showLoadingState = ""
    }

    view() {
        var self = this

        var dbnameClass
        var tablenameClass

        if(!self.selectedDbname) {
            dbnameClass = "hide"
        }

        if(!self.selectedTablename) {
            tablenameClass = "hide"
        }

        return (
            <div class="w3-margin-top">
                <ul class="w3-navbar w3-border w3-light-grey">
                    <li><a href="/#/">Server</a></li>
                    <li class={dbnameClass}><a href="/#/">{self.selectedDbname}</a></li>
                    <li class={tablenameClass}><a href="/#/">{self.selectedTablename}</a></li>
                    <li class={"w3-right " + self.showLoadingState}><a><i class="fa fa-gear w3-spin"></i></a></li>
                </ul>

                <div 
                class={"w3-panel w3-pale-red w3-border w3-border-red w3-padding " + self.showErrorAlertState}>
                    
                    <span class="w3-closebtn"
                        onclick={self.hideError.bind(self)}
                    >
                        ×
                    </span>

                    <p>
                        {self.error}
                    </p>

                </div>

            </div>
        );
    }

}
