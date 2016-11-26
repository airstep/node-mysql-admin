import m from 'mithril' 
import Component from './component'

export default class Alert extends Component {

    view () {
        return (
    		<div class="w3-panel w3-pale-green w3-border w3-border-green">
				<p>{this.props.message}</p>
			</div>
        );
    }

}
